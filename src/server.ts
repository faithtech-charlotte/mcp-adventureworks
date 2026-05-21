import "dotenv/config";
import { randomUUID } from "node:crypto";
import express, { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getDb } from "./db/connection";
import { registerProductTools } from "./tools/products";
import { registerSalesTools } from "./tools/sales";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main(): Promise<void> {
  // ── Database connection ──────────────────────────────────────────────────
  const db = await getDb();

  // Each MCP session gets its own McpServer instance — the SDK's underlying
  // Server.connect() rejects a second transport on the same server.
  const buildServer = (): McpServer => {
    const server = new McpServer({
      name: "adventureworks-mcp",
      version: "1.0.0",
    });
    registerProductTools(server, db);
    registerSalesTools(server, db);
    return server;
  };

  // ── Express + Streamable HTTP Transport ──────────────────────────────────
  const app = express();
  app.use(express.json());

  // One transport per session, keyed by the Mcp-Session-Id header.
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // POST /mcp — JSON-RPC requests (initialize + tool calls)
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport = sessionId ? transports.get(sessionId) : undefined;

    if (!transport) {
      if (sessionId || !isInitializeRequest(req.body)) {
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: no valid session ID provided" },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
          console.log(`[${new Date().toISOString()}] MCP session opened: ${id}`);
        },
      });

      transport.onclose = () => {
        if (transport!.sessionId) {
          transports.delete(transport!.sessionId);
          console.log(`[${new Date().toISOString()}] MCP session closed: ${transport!.sessionId}`);
        }
      };

      await buildServer().connect(transport);
    }

    await transport.handleRequest(req, res, req.body);
  });

  // GET /mcp — server-initiated SSE stream for notifications
  // DELETE /mcp — explicit session termination
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transport.handleRequest(req, res);
  };
  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "adventureworks-mcp", connections: transports.size });
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 MCP server running on http://localhost:${PORT}`);
    console.log(`   MCP endpoint: http://localhost:${PORT}/mcp`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`\n   Inspector:    npx @modelcontextprotocol/inspector http://localhost:${PORT}/mcp\n`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
