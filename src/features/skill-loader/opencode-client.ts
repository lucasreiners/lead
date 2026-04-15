import type { LoadedSkill } from "./types"

/**
 * Fetch skills from the OpenCode server skill endpoint.
 * Returns an empty array on any error (connection refused, timeout, etc.)
 */
export async function fetchSkillsFromApi(
  serverUrl: URL | string,
  directory: string,
  timeoutMs = 3000
): Promise<LoadedSkill[]> {
  try {
    const url = new URL("/skill", serverUrl)
    url.searchParams.set("directory", directory)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(url.toString(), { signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      return []
    }

    const json = await response.json() as unknown
    if (!Array.isArray(json)) {
      return []
    }

    const skills: LoadedSkill[] = []
    for (const item of json) {
      if (
        item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).content === "string"
      ) {
        const raw = item as Record<string, unknown>
        // Derive source from location path
        const location = typeof raw.location === "string" ? raw.location : ""
        const source: LoadedSkill["source"] = location.includes(".opencode")
          ? "project"
          : "user"

        skills.push({
          name: raw.name as string,
          content: raw.content as string,
          source,
          metadata: {
            description: typeof raw.description === "string" ? raw.description : undefined,
          },
        })
      }
    }
    return skills
  } catch {
    // Connection refused, timeout, parse error — all return empty
    return []
  }
}
