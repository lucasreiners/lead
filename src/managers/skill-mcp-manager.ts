/**
 * SkillMcpManager.
 * Stub for MCP server declarations from skills.
 * v0.1: No-op placeholder — full MCP integration deferred to future release.
 */

export interface McpServerConfig {
  type?: "stdio" | "http"
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export interface SkillMcpClientInfo {
  sessionId: string
  skillName: string
  serverName: string
}

/**
 * SkillMcpManager manages MCP server connections declared by skills.
 * Currently a stub — only stdio support planned, HTTP deferred.
 */
export class SkillMcpManager {
  /** v0.1: No active connections */
  async getOrCreateClient(
    _info: SkillMcpClientInfo,
    _config: McpServerConfig,
  ): Promise<void> {
    // Not implemented in v0.1
    throw new Error("SkillMcpManager.getOrCreateClient not implemented in v0.1")
  }

  /** v0.1: Stub — throws not implemented */
  async callTool(
    _info: SkillMcpClientInfo,
    _config: McpServerConfig,
    _name: string,
    _args: unknown,
  ): Promise<unknown> {
    throw new Error("SkillMcpManager.callTool not implemented in v0.1")
  }

  /** Disconnect all clients for a session */
  async disconnectSession(_sessionId: string): Promise<void> {
    // No-op in v0.1
  }

  /** Disconnect all clients */
  async disconnectAll(): Promise<void> {
    // No-op in v0.1
  }
}
