import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createServer } from "node:net"

// Run after `bun run build`. Requires a V2 `opencode` executable on PATH.
// Every API call uses our own server with isolated config, state and HOME.
const repository = resolve(import.meta.dir, "..")
const root = mkdtempSync(join(tmpdir(), "lead-v2-package-"))
const project = join(root, "project")
mkdirSync(project)
let server: ReturnType<typeof Bun.spawn> | undefined
let serverLogs: Promise<string> | undefined

function run(cmd: string[], cwd: string, env = process.env): string {
  const result = Bun.spawnSync(cmd, { cwd, env, stdout: "pipe", stderr: "pipe", timeout: 120_000 })
  if (result.exitCode !== 0) {
    throw new Error(`${cmd.join(" ")} failed:\n${result.stdout}\n${result.stderr}`)
  }
  return result.stdout.toString()
}

try {
  run(["npm", "pack", "--pack-destination", root], repository)
  const archive = readdirSync(root).find((file) => file.endsWith(".tgz"))
  if (!archive) throw new Error("npm pack produced no archive")
  writeFileSync(join(project, "package.json"), JSON.stringify({ private: true, type: "module" }))
  run(["bun", "add", join(root, archive)], project)
  run(["node", "--input-type=module", "-e", `
    import plugin from "@lucasreiners/lead";
    if (plugin.id !== "lead" || typeof plugin.setup !== "function" || "server" in plugin) {
      throw new Error("Expected a V2-only plugin definition");
    }
  `], project)
  // Local plugin directories in 2.0.27 use index.ts. Import the installed npm
  // package through its public export, rather than relying on local path/main resolution.
  const localPlugin = join(project, "plugins/lead")
  mkdirSync(localPlugin, { recursive: true })
  writeFileSync(join(localPlugin, "index.ts"), 'export { default } from "@lucasreiners/lead"\n')
  writeFileSync(join(project, "opencode.json"), JSON.stringify({
    plugins: [{ package: localPlugin, options: { log_level: "ERROR" } }],
  }))

  const env = {
    ...process.env,
    HOME: root,
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    XDG_STATE_HOME: join(root, "state"),
    XDG_CACHE_HOME: join(root, "cache"),
    OPENCODE_PASSWORD: crypto.randomUUID(),
  }
  const listener = createServer()
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject)
    listener.listen(0, "127.0.0.1", resolve)
  })
  const address = listener.address()
  if (!address || typeof address === "string") throw new Error("Cannot allocate smoke-test port")
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()))
  const url = `http://127.0.0.1:${address.port}`
  server = Bun.spawn(["opencode", "serve", "--hostname", "127.0.0.1", "--port", String(address.port), "--print-logs", "--log-level", "debug"], {
    cwd: project, env, stdout: "pipe", stderr: "pipe",
  })
  serverLogs = new Response(server.stderr).text()
  const deadline = Date.now() + 30_000
  let responseStatus: number | undefined
  while (true) {
    if (server.exitCode !== null) throw new Error(`Smoke server exited: ${await serverLogs}`)
    try {
      const response = await fetch(`${url}/api/info`, { signal: AbortSignal.timeout(1000) })
      responseStatus = response.status
      if (response.ok || response.status === 401) break
    } catch { /* Wait for our private server to listen. */ }
    if (Date.now() >= deadline) throw new Error(`Smoke server did not become ready (HTTP ${responseStatus ?? "unreachable"})`)
    await Bun.sleep(100)
  }
  const version = (await Bun.file(join(repository, "package.json")).json()).version
  async function verifyLocation(directory: string, source: string): Promise<void> {
    const api = (operation: string) => JSON.parse(run([
      "opencode", "api", "--server", url, operation,
      "--param", `location[directory]=${directory}`,
    ], directory, env))

    api("location.get")
    // Location startup is asynchronous; registry reads expose registrations so far.
    const activationDeadline = Date.now() + 30_000
    while (true) {
      const plugins = api("plugin.list")
      const lead = plugins.data.find((plugin: { id?: string; source: { type: string; path?: string } }) =>
        plugin.id === "lead" || plugin.source.path?.startsWith(source))
      if (lead?.state.status === "active") break
      if (lead?.state.status === "failed") throw new Error(`Plugin failed: ${JSON.stringify(lead)}`)
      if (Date.now() >= activationDeadline) throw new Error(`Plugin did not activate at ${directory} within 30 seconds`)
      await Bun.sleep(100)
    }
    const agents = api("agent.list")
    for (const id of ["tech-lead", "lead-dev", "product-owner", "engineer", "architect", "code-analyst", "researcher", "reviewer", "tester", "guardian"]) {
      if (!agents.data.some((agent: { id: string }) => agent.id === id)) throw new Error(`Missing agent: ${id}`)
    }
    const lead = agents.data.find((agent: { id: string }) => agent.id === "tech-lead")
    if (lead.name !== `Tech Lead · ${version}`) throw new Error(`Unexpected built version: ${lead.name}`)

    const commands = api("command.list")
    for (const name of ["implement", "run-workflow", "finalize-issue", "read-existing-issue"]) {
      if (!commands.data.some((command: { name: string }) => command.name === name)) throw new Error(`Missing command: ${name}`)
    }
  }

  await verifyLocation(project, localPlugin)
  const localProject = join(root, "local-project")
  mkdirSync(localProject)
  writeFileSync(join(localProject, "opencode.jsonc"), JSON.stringify({ plugins: [repository] }))
  await verifyLocation(localProject, repository)
  console.log(`V2 package and local-checkout smoke passed: lead ${version} active, 10 agents, 4 commands each.`)
} catch (error) {
  if (server) {
    server.kill()
    await server.exited
  }
  const logs = (await serverLogs ?? "").split("\n").filter((line) => /message="[^"]*(plugin|failed|error)|level=(ERROR|WARN)|^\[lead/i.test(line)).slice(-30).join("\n")
  throw new Error(`${String(error)}\n${logs}`, { cause: error })
} finally {
  if (server) {
    server.kill()
    await server.exited
  }
  rmSync(root, { recursive: true, force: true })
}
