/**
 * Handle the /read-existing-issue command.
 * Returns a prompt instructing the Product Owner to fetch an existing ticket
 * from the ticket system and save it locally in the requirement template format.
 */
export function handleReadExistingIssue(args: string): { prompt: string; error?: string } {
  if (!args.trim()) {
    return {
      prompt: "",
      error: "Usage: /read-existing-issue <ticket-id>  (e.g. GH-123, PROJ-456, #42)",
    }
  }

  const ticketId = args.trim()

  const prompt = `You need to import an existing ticket into the local requirements folder.

TICKET TO IMPORT: ${ticketId}

CRITICAL: Your LAST action MUST be a question tool call. Do NOT end your response with text. You MUST end with the question tool.

INSTRUCTIONS:
1. Use the available MCP tools (Jira, GitHub Issues, Linear, etc.) to fetch the full content of ticket "${ticketId}"
2. If no ticket system tools are available, inform the user that they need to configure an MCP server for their ticket system (e.g., jira-mcp, github-mcp) and stop
3. Read the ticket content: title, description, comments, labels, assignees, status, linked issues
4. Convert the ticket into our local requirement template format:

\`\`\`markdown
# {Feature Name from ticket title}

## Summary
[Summarize the ticket's intent in 2-3 sentences]

## User Stories

- As a [persona], I want to [action] so that [benefit].

## Acceptance Criteria

- [ ] [Derive from ticket description, comments, and any existing criteria]

## Out of Scope

- [Derive from ticket or mark "To be defined"]

## Dependencies

- [Derive from linked issues, labels, or mentioned systems]

## Open Questions

- [ ] [Flag anything unclear or missing from the original ticket]
\`\`\`

5. Save the requirement to \`.lead/requirements/{slug}.md\` where {slug} is derived from the ticket ID (e.g. \`gh-123.md\`, \`proj-456.md\`)
6. If the original ticket has a different structure, migrate it to our template — do NOT preserve the original format. Fill in what you can, mark gaps as Open Questions.
7. Present a brief summary of the imported requirement to the stakeholder.
8. MANDATORY FINAL STEP — You MUST call the question tool with:
   - Question: "I imported issue ${ticketId} and saved it to the local requirements folder. What should we do now?"
   - Options:
     a. "Analyze & clarify" — PO analyzes the requirement for gaps and ambiguities, then starts the Clarify → Research → Update → Present loop
     b. "I have specific feedback" — Stakeholder has remarks or questions to address first

IMPORTANT: This is a FUNCTIONAL import — focus on what the feature should do, not how it should be built. Strip out any technical implementation details from the original ticket into a separate "Technical Notes (for Architect)" section at the bottom, or drop them entirely.`

  return { prompt }
}
