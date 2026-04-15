/**
 * Trims leading/trailing whitespace from each line and collapses consecutive
 * blank lines into at most one blank line. Also trims the entire result.
 *
 * Used by agent prompt builders to normalize inline prompt strings.
 */
export function trimPrompt(text: string): string {
  const lines = text.split("\n")
  const trimmedLines = lines.map((line) => line.trimEnd())

  // Collapse runs of blank lines into a single blank line
  const collapsed: string[] = []
  let previousWasBlank = false
  for (const line of trimmedLines) {
    const isBlank = line.trim() === ""
    if (isBlank && previousWasBlank) continue
    collapsed.push(line)
    previousWasBlank = isBlank
  }

  return collapsed.join("\n").trim()
}

/**
 * Strips leading/trailing blank lines from each section of an XML-style tag.
 * Useful for cleaning up agent prompt templates before injection.
 */
export function normalizeXmlSection(tag: string, content: string): string {
  const body = content.trim()
  return `<${tag}>\n${body}\n</${tag}>`
}
