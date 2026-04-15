/**
 * Keyword detector.
 * Detects workflow-related keywords in user messages.
 */

export type DetectedKeyword =
  | "run-workflow"
  | "implement"
  | "workflow-pause"
  | "workflow-skip"
  | "workflow-abort"
  | "workflow-status"
  | "workflow-resume"

export interface KeywordDetectionResult {
  /** All detected keywords */
  keywords: DetectedKeyword[]
  /** The primary (first detected) keyword */
  primary?: DetectedKeyword
  /** Arguments following the primary keyword */
  args?: string
}

/** Keyword patterns — order matters (more specific first) */
const KEYWORD_PATTERNS: Array<{ keyword: DetectedKeyword; patterns: RegExp[] }> = [
  {
    keyword: "run-workflow",
    patterns: [/^\/run-workflow\b/i, /^run-workflow\b/i],
  },
  {
    keyword: "implement",
    patterns: [/^\/implement\b/i, /^implement\b/i],
  },
  {
    keyword: "workflow-pause",
    patterns: [/\bworkflow\s+pause\b/i, /\bpause\s+workflow\b/i],
  },
  {
    keyword: "workflow-skip",
    patterns: [/\bworkflow\s+skip\b/i, /\bskip\s+step\b/i],
  },
  {
    keyword: "workflow-abort",
    patterns: [/\bworkflow\s+abort\b/i, /\babort\s+workflow\b/i],
  },
  {
    keyword: "workflow-status",
    patterns: [/\bworkflow\s+status\b/i],
  },
  {
    keyword: "workflow-resume",
    patterns: [/\bworkflow\s+resume\b/i, /\bresume\s+workflow\b/i],
  },
]

/**
 * Process a user message and detect workflow-related keywords.
 */
export function processMessageForKeywords(message: string): KeywordDetectionResult {
  const detected: DetectedKeyword[] = []
  let primary: DetectedKeyword | undefined
  let args: string | undefined

  for (const { keyword, patterns } of KEYWORD_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        detected.push(keyword)
        if (!primary) {
          primary = keyword
          // Extract arguments following the keyword
          const match = message.match(pattern)
          if (match) {
            const afterKeyword = message.slice(match.index! + match[0].length).trim()
            if (afterKeyword) {
              args = afterKeyword
            }
          }
        }
        break // Only count each keyword once
      }
    }
  }

  return { keywords: detected, primary, args }
}
