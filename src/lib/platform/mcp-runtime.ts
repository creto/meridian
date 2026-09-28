import { mcpTools } from "./mcp.ts";
import type { FormDefinition } from "../forms/types.ts";

export interface McpRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
}

/** JSON-RPC handler for an MCP stdio process. Tool calls go through the same agent functions as HTTP. */
export function handleMcpMessage(message: McpRequest, forms: FormDefinition[], callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>) {
  const id = message.id ?? null;
  if (message.method === "initialize") {
    return { jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "meridian", version: "1.0.0" } } };
  }
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: mcpTools(forms).tools } };
  }
  if (message.method === "tools/call") {
    const name = message.params?.name ?? "";
    return callTool(name, message.params?.arguments ?? {}).then((content) => ({
      jsonrpc: "2.0",
      id,
      result: { content: [{ type: "text", text: JSON.stringify(content) }] },
    }));
  }
  return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${message.method}` } };
}
