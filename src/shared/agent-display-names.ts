const BUILTIN_DISPLAY_NAMES: Record<string, string> = {
  "tech-lead": "Tech Lead",
  engineer: "Engineer",
  "lead-dev": "Lead Developer",
  architect: "Architect",
  "code-analyst": "Code Analyst",
  researcher: "Researcher",
  reviewer: "Reviewer",
  tester: "Tester",
  guardian: "Guardian",
  "product-owner": "Product Owner",
}

const overrides: Record<string, string> = {}

export function getAgentDisplayName(key: string): string {
  return overrides[key] ?? BUILTIN_DISPLAY_NAMES[key] ?? key
}

export function updateBuiltinDisplayName(key: string, name: string): void {
  overrides[key] = name
}

export function getAllDisplayNames(): Record<string, string> {
  return { ...BUILTIN_DISPLAY_NAMES, ...overrides }
}
