// Version is inlined at build time from package.json
// For runtime use, we read it directly
import packageJson from "../../package.json" with { type: "json" }

export function getVersion(): string {
  return packageJson.version
}
