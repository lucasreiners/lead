/**
 * Handle the /finalize-issue command.
 * Returns a prompt instructing the Product Owner to push the finalized requirement
 * to the configured ticket system via available MCP tools.
 */
export function handleFinalizeIssue(args: string): { prompt: string } {
  const prompt = `You are now finalizing a requirement for submission to the ticket system.

INSTRUCTIONS:
1. Review the current requirement that has been agreed upon with the stakeholder
2. Format it according to the ticket system's requirements
3. Use the available MCP tools (Jira, GitHub Issues, Linear, etc.) to create the ticket
4. If no ticket system tools are available, inform the user that they need to configure an MCP server for their ticket system (e.g., jira-mcp, github-mcp)
5. After creating the ticket, confirm the ticket ID/URL to the user

${args ? `Additional context: ${args}` : ""}

IMPORTANT: If you cannot detect any ticket system MCP tools, do NOT attempt to create a ticket. Instead, clearly explain what MCP server the user needs to configure and how.`

  return { prompt }
}
