import { resolve } from "path"
import { rmSync } from "node:fs"

const jsoncParserEsm: import("bun").BunPlugin = {
  name: "jsonc-parser-esm",
  setup(build) {
    build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
      path: resolve("node_modules/jsonc-parser/lib/esm/main.js"),
    }))
  },
}

const pkg = await Bun.file("./package.json").json()

// Removed source modules must not leave stale declaration files in the package.
rmSync(resolve("dist"), { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  external: ["@opencode/plugin", "zod", "picocolors"],
  plugins: [jsoncParserEsm],
  define: {
    __LEAD_VERSION__: JSON.stringify(pkg.version),
  },
  minify: false,
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
console.log("Build succeeded:", result.outputs.map((o) => o.path))
