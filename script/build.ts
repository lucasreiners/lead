import { resolve } from "path"

const jsoncParserEsm: import("bun").BunPlugin = {
  name: "jsonc-parser-esm",
  setup(build) {
    build.onResolve({ filter: /^jsonc-parser$/ }, () => ({
      path: resolve("node_modules/jsonc-parser/lib/esm/main.js"),
    }))
  },
}

const pkg = await Bun.file("./package.json").json()

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  external: ["@opencode-ai/plugin", "@opencode-ai/sdk", "zod", "picocolors"],
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
