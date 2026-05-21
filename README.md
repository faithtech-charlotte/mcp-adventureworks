# mcp-adventureworks

**Workshop demo repo** — Build an MCP server in TypeScript that lets Claude query AdventureWorks via natural language in Claude.ai chat.

---

## What This Is

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes AdventureWorks data as tools Claude can discover and call autonomously. Users ask questions in plain English; Claude picks the right tool, runs the query, and returns a formatted answer — no custom UI required.

**Example conversations:**
- *"What are our top 10 best-selling products this year?"*
- *"Show sales by territory for Q3 compared to Q2"*
- *"Which customers haven't ordered in 6 months?"*
- *"Which products are below their reorder point?"*

---

## Quick Start

### 1. Start AdventureWorks (Docker)

```bash
docker run \
  -e 'ACCEPT_EULA=Y' \
  -e 'SA_PASSWORD=YourPass123!' \
  -p 1433:1433 \
  -d chriseaton/adventureworks:latest
```

Verify it's running:

```bash
docker ps
# Should show chriseaton/adventureworks container
```

### 2. Configure the MCP Server

```bash
git clone https://github.com/faithtech-charlotte/mcp-adventureworks
cd mcp-adventureworks

npm install

cp .env.example .env
# Edit .env — set DB_PASSWORD to match what you passed above
```

### 3. Run the Server

```bash
npm run dev
```

Expected output:
```
✅  Connected to AdventureWorks

🚀 MCP server running on http://localhost:3000
   SSE endpoint: http://localhost:3000/sse
   Health check: http://localhost:3000/health

   Inspector:    npx @modelcontextprotocol/inspector http://localhost:3000/sse
```

### 4. Test with MCP Inspector

Before connecting to Claude, verify your tools are registered:

```bash
npm run inspector
# Opens browser at http://localhost:5173
# → Lists tools, lets you call them with test parameters
```

### 5. Connect to Claude.ai

Your server needs to be reachable from the internet over HTTPS. Pick one of the options below.

#### Option A: ngrok (quickest, ephemeral URL)

```bash
npx ngrok http 3000
# Outputs: https://abc123.ngrok-free.app
```

The free tier gives you a new random URL every restart — you'll have to update the integration in Claude.ai each time.

#### Option B: Microsoft Dev Tunnels (persistent, same URL across restarts)

If you'd rather not re-paste a new URL every session, create a named dev tunnel once and reuse it. Requires the [`devtunnel` CLI](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started).

**One-time setup:**

```bash
devtunnel user login

# Create a named tunnel — the ID becomes part of the URL
devtunnel create mcp-adventureworks --allow-anonymous

# Bind it to port 3000
devtunnel port create mcp-adventureworks -p 3000 --protocol http
```

**Each time you want to expose the server:**

```bash
npm run dev                           # in one terminal
devtunnel host mcp-adventureworks     # in another
```

The hosted URL looks like `https://mcp-adventureworks-3000.usw2.devtunnels.ms` and stays stable as long as the tunnel exists (idle tunnels expire after ~30 days — just `devtunnel host` again to keep it alive).

Useful commands:

```bash
devtunnel list                        # show all your tunnels
devtunnel show mcp-adventureworks     # print the exact URL
devtunnel delete mcp-adventureworks   # remove it
```

> **Note:** Dev Tunnels only lets you customize the tunnel ID, not the full domain. If you need a true vanity hostname (`mcp.yourcompany.com`), use Cloudflare Tunnel or a paid ngrok reserved domain instead.

#### Configure the integration in Claude.ai

Whichever option you chose:

1. **Settings → Integrations → Add Integration**
2. Paste your SSE URL: `https://<your-tunnel-host>/mcp`
3. Open a new chat, enable the integration toggle
4. Ask a question — Claude will call your tools automatically

---

## Project Structure

```
mcp-adventureworks/
├── src/
│   ├── server.ts             # Entry point: Express + SSE transport + tool registration
│   ├── db/
│   │   └── connection.ts     # mssql connection pool (reads from .env)
│   └── tools/
│       ├── products.ts       # Products tools: search, reorder list
│       └── sales.ts          # Sales tools: top products, by territory, inactive customers
├── exercises/
│   └── stubs.ts              # Workshop exercise stubs (uncomment and complete)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Available Tools

| Tool | Description |
|---|---|
| `products_search` | Search products by name, color, or category |
| `products_reorder_list` | Products at or below reorder point |
| `sales_top_products` | Best sellers by revenue or quantity |
| `sales_by_territory` | Revenue breakdown by sales territory |
| `sales_inactive_customers` | Customers with no orders in N days |

---

## Workshop Exercises

See [`exercises/stubs.ts`](exercises/stubs.ts) for three challenges:

| Level | Tool to Build |
|---|---|
| 🟢 Starter | Products by subcategory with list price |
| 🟡 Intermediate | Top salespeople by revenue for a date range |
| 🔴 Advanced | Customers at churn risk |

To enable an exercise tool:
1. Open `exercises/stubs.ts`, uncomment the `server.tool()` block
2. Fill in the SQL query and description
3. In `src/server.ts`, import and call `registerExerciseTools(server, db)`
4. Restart: `npm run dev`
5. Verify in Inspector, then test in Claude

---

## Adding Your Own Tools

1. Create a new file in `src/tools/`, e.g. `src/tools/purchasing.ts`
2. Export a `registerPurchasingTools(server, db)` function
3. Add `server.tool()` calls inside it
4. Import and call it in `src/server.ts`

**Tool registration pattern:**

```typescript
server.tool(
  "tool_name",                    // snake_case, namespaced (e.g. purchasing_vendors)
  `Clear description of what this tool does and WHEN Claude should use it.
   Be explicit about the business scenario, not the implementation.`,
  {
    param: z.string().describe("What this parameter controls"),
  },
  async ({ param }) => {
    try {
      const request = db.request();
      request.input("p", param);
      const result = await request.query(`SELECT ... WHERE Col = @p`);
      return { content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
    }
  }
);
```

---

## Design Principles (SOLID Applied to MCP)

| Principle | MCP Application |
|---|---|
| **Single Responsibility** | One tool, one job. Don't make a multi-mode `get_product` — make `products_search` and `products_by_id`. |
| **Open/Closed** | Add tool groups in new files; don't modify existing ones to add unrelated tools. |
| **Liskov Substitution** | Tools with the same intent should share parameter names (`limit`, `year`, `startDate`). |
| **Interface Segregation** | Don't bundle read and write tools in the same group. |
| **Dependency Inversion** | Tools depend on `ConnectionPool` (abstraction), not on a specific query implementation. |

---

## Production Checklist

- [ ] Add Bearer token validation to the SSE endpoint
- [ ] Use parameterized queries everywhere (already done in this demo)
- [ ] Deploy behind HTTPS (required by Claude.ai)
- [ ] Add request logging with tool name, parameters, duration
- [ ] Add rate limiting (e.g. `express-rate-limit`)
- [ ] Consider Azure API Management for auth + throttling
- [ ] Use Azure Managed Identity instead of SA password for SQL auth

---

## Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [C# SDK (for .NET shops)](https://github.com/modelcontextprotocol/csharp-sdk) — `ModelContextProtocol` on NuGet
- [Anthropic MCP Docs](https://docs.anthropic.com/en/docs/agents/mcp)
- [AdventureWorks Schema Reference](https://dataedo.com/samples/html/AdventureWorks/)

---

## Branches

| Branch | Contents |
|---|---|
| `starter` | Skeleton with TODOs — **start here** |
| `main` | Complete working solution |
| `exercises` | Exercise stubs + solutions |
| `with-auth` | Adds Bearer token auth + rate limiting |
| `azure-deploy` | Azure App Service deployment + Managed Identity |

---

*Built for the MCP Server Workshop. TypeScript · mssql · AdventureWorks · @modelcontextprotocol/sdk*
