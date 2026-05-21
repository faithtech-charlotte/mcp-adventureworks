# MCP Server Workshop — Facilitator Runbook

**Duration:** ~60 minutes  
**Format:** Presentation + Live demo + Hands-on exercise  
**Audience:** Tech enthusiasts, developers (any level)  
**Prerequisites attendees need:** Docker, Node.js 18+, a Claude.ai account (free tier OK), git

---

## Pre-Workshop Checklist (Do This 30 Min Before)

- [ ] `docker run --name adventureworks -p 1433:1433 -e ACCEPT_EULA=Y -e MSSQL_ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD="StrongerPassw0rd!2026" -d chriseaton/adventureworks:latest`
- [ ] Verify DB: `docker ps` shows container running
- [ ] `cd mcp-adventureworks && npm install && npm run dev` — server on port 3000
- [ ] Run `npx ngrok http 3000` — note the HTTPS URL (e.g. `https://abc123.ngrok.io`)
- [ ] In Claude.ai: Settings → Integrations → Add Integration → paste `https://abc123.ngrok.io/mcp`
- [ ] Test in Claude: *"What tables are available in the database?"* — confirm a tool call fires
- [ ] Slides open on slide 1, presenter notes hidden
- [ ] Attendee machines: clone repo, `npm install` done, Docker pulled (saves time)

---

## Slide-by-Slide Script

---

### Slide 1 — Title (0:00–0:02)

**Say:**
> "Welcome everyone. Today we're going to build something that I think changes how you think about AI assistants entirely. By the end of the next hour you'll have your own MCP server running — and Claude will be querying your database in plain English. Let's get into it."

**Action:** Show slide. Let people settle.

---

### Slide 2 — Agenda (0:02–0:04)

**Say:**
> "Quick agenda. We're keeping it tight at 60 minutes. First half is concept and demo so you can see exactly what we're building. Second half is code — we'll walk through every line. Then you'll add your own tool."

> "The timestamps are rough guides. If you have questions along the way, ask — this is not a lecture."

---

### Slide 3 — What is MCP? (0:04–0:10)

**Say:**
> "Model Context Protocol. Anthropic announced this in November 2024 and the community response was massive — it's now an open standard with hundreds of community servers."

> "The core idea: before MCP, if you wanted Claude to talk to your database, you'd build a chat app, hook up the API, write custom tool-calling logic, handle state — a lot of plumbing. MCP standardizes that plumbing. You write a server that *exposes capabilities*. Claude discovers them and uses them on its own."

**Point to the three pillars:**
> "There are three primitives. **Tools** — functions Claude can call, like querying a table or sending an email. **Resources** — read-only data Claude can pull in as context, like a schema doc. **Prompts** — reusable prompt templates. Today we're almost entirely focused on Tools, because that's where 90% of the value is for conversational use cases."

**Discussion prompt (optional, 2 min):**
> "Quick show of hands — how many of you have built something with an LLM API before? Great. How many hit a wall when you needed it to actually *do* something with your data?"

---

### Slide 4 — MCP vs Traditional API (0:10–0:13)

**Say:**
> "This slide captures the paradigm shift. On the left: the traditional approach. You write code that calls specific endpoints, you parse responses, you decide what to do with them. The AI is just one component in your app."

> "On the right: with MCP, the AI is the orchestrator. It reads the tool descriptions you provide, decides which tool fits the user's question, calls it, gets the result, and synthesizes the answer. You're not writing orchestration logic anymore — you're writing *capability descriptions*."

> "The punchline: users don't need a custom UI. They just talk to Claude. That's the broader applicability I want you to walk away with today."

---

### Slide 5 — Architecture (0:13–0:18)

**Say:**
> "Here's exactly what happens when someone asks Claude a question through your MCP server."

**Walk the flow left to right:**
> "User types a question in Claude chat. Claude reads the question, looks at the list of tools your MCP server advertised, and decides which one to call. It sends a JSON-RPC request to your server using the Streamable HTTP transport — that's the MCP protocol. A single `/mcp` endpoint handles requests, and the server can stream responses back over SSE when needed. Your server runs the handler, queries AdventureWorks via mssql, and returns JSON. Claude reads that JSON and writes a human-readable answer."

> "The important thing: your MCP server is just an HTTP server. It's a Node.js Express app. Nothing exotic."

> "The MCP protocol sits between Claude and your server. It's JSON-RPC 2.0 — request/response with a defined schema. The SDK handles all of this so you don't think about the wire format."

---

### Slide 6 — Demo Setup (0:18–0:22)

**Say:**
> "Let's talk environment. AdventureWorks is a classic Microsoft sample database — it's been around since SQL Server 2000 and covers a fictional bicycle company. Products, sales orders, customers, employees, vendors. It's rich enough to ask genuinely interesting questions."

> "The Docker image from chriseaton is pre-configured — one `docker run` command and you have a fully loaded SQL Server instance. No SQL Server license needed."

**Walk the four steps:**
> "Pull and run the container. Clone the workshop repo. `npm install` and set your connection string in `.env`. `npm run dev` starts the MCP server. That's it."

**Checkpoint:** *Pause and verify everyone's server is running.* Ask: "Who sees 'MCP server running on :3000' in their terminal?"

---

### Slide 7 — Live Demo (0:22–0:28)

**Say:**
> "Let me show you this before we look at any code. Seeing is believing."

**[LIVE DEMO — switch to Claude.ai]**

Run these in order, narrating as Claude responds:

1. **"What are our top 10 best-selling products this year?"**
   > "Watch the tool call appear in the UI — Claude is literally calling our search_products tool right now. And there's the result — formatted, readable, exactly what you'd want."

2. **"Show me sales by territory for Q3 and compare to last quarter"**
   > "Notice Claude chains two tool calls here — it didn't need explicit instructions to do that."

3. **"Which customers haven't placed an order in 6 months?"**
   > "This is the power. That's a multi-table join with a date calculation. The user typed plain English. Claude figured out the query."

4. **"Give me a reorder list for products below safety stock level"**
   > "This one shows Claude understanding business domain context from the tool description alone."

**Say:**
> "Everything you just saw came from about 150 lines of TypeScript. Let's look at how."

---

### Slide 8 — Anatomy (0:28–0:33)

**Say:**
> "Here's the project structure. There are three key files."

**Point to each:**
> "`server.ts` is the entry point — it creates the McpServer instance and wires up the Express HTTP server with the Streamable HTTP transport. One time setup."

> "`tools/products.ts`, `tools/sales.ts`, etc. — each file registers a group of related tools. This is where you spend most of your time."

> "`db/connection.ts` — a simple mssql connection pool. Nothing MCP-specific."

**Right side concepts:**
> "Three classes you'll use from the SDK. `McpServer` — the top-level object. `registerTool()` — the method you call to register a tool (the older `tool()` method is now deprecated). `StreamableHTTPServerTransport` — the transport layer. Use Streamable HTTP for Claude.ai remote integrations, stdio for local command-line tools. The legacy `SSEServerTransport` is deprecated — Streamable HTTP replaces it and still uses SSE under the hood when streaming is needed."

---

### Slide 9 — Tool Definition Code (0:33–0:38)

**[Switch to code editor or use slide]**

**Say:**
> "This is the full implementation of `search_products`. Walk through it with me."

**Point to each section:**
> "`server.registerTool()` takes three arguments. First: the tool name — this is what Claude sees and uses to decide which tool to call. Make it a snake_case verb-noun: `products_search`, not just `search`."

> "Second: the config object — `{ description, inputSchema }`. The **description** is your prompt to Claude. It tells Claude what the tool does and — critically — when to use it. The better this description, the better Claude's judgment. If it's vague, Claude either won't use the tool when it should, or will use it when it shouldn't. The **inputSchema** is a Zod shape that validates the parameters Claude passes. `.describe()` on each field tells Claude what each parameter means."

> "Third: the async handler. This runs when Claude calls the tool. Query the DB, return `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`. That's the MCP response format."

> "Note: older examples on the web use `server.tool(name, description, schema, handler)` — that signature still works but is deprecated. Use `registerTool` for new code."

> "The SQL uses parameterized queries — `@query`, `@limit`. Never string-interpolate user input. Claude's parameters are user-derived."

**Common question:** *"Can I return anything other than text?"*
> "Yes — you can return `type: 'image'` or `type: 'resource'`. For most DB use cases, JSON-as-text is what you want."

---

### Slide 10 — server.ts Wiring (0:38–0:40)

**Say:**
> "The entry point is mostly boilerplate you'll write once. Create an McpServer with a name and version. Create an mssql connection pool. Call your tool registration functions. Wire up the `/mcp` route with the Streamable HTTP transport. Start the Express server."

> "A single `/mcp` endpoint handles everything. **POST** carries JSON-RPC requests — including the initial `initialize` call, which spins up a new transport and returns an `Mcp-Session-Id` header. Subsequent POSTs reuse that session ID to route to the same transport. **GET** opens a server-to-client SSE stream for notifications. **DELETE** lets the client cleanly terminate a session."

> "You only touch this file when you're adding a new tool group."

---

### Slide 11 — Three MCP Primitives (0:40–0:43)

**Say:**
> "Quick recap of what's possible beyond tools. You don't need these today, but file them away."

> "**Resources** — imagine Claude could always see your product catalog schema, or a list of valid territory codes. You expose those as resources and Claude automatically includes them when it's working in that domain."

> "**Prompts** — parameterized prompt templates. Your manager asks 'run the weekly sales summary' every Monday. You make that a named prompt, Claude fills in the date range, runs the right tools, formats the output. One-click repeated workflow."

---

### Slide 12 — Registering with Claude (0:43–0:46)

**Say:**
> "Four steps to connect your server to Claude.ai."

**Step 1:**
> "Your server needs to be reachable from the internet. Locally, ngrok is the easiest option. In production you'd deploy to Azure App Service, a container, wherever."

**Step 2:**
> "Go to Claude.ai, Settings, Integrations, Add Integration. Paste your `/mcp` endpoint URL (e.g. `https://abc123.ngrok.io/mcp`). Claude will immediately try to connect and fetch your tool list."

**Step 3:**
> "In a new chat, enable the integration via the toggle. Each chat session decides independently which integrations are active."

**Step 4:**
> "Ask a question that should trigger a tool. If it works — great. If not, check the MCP Inspector."

---

### Slide 13 — Debugging (0:46–0:49)

**Say:**
> "The MCP Inspector is your best friend during development. It's a web UI that connects to your server, lists all your registered tools, and lets you call them with test parameters without Claude involved."

> "If a tool works in Inspector but not in Claude, the problem is your description — Claude isn't recognizing when to use it. If it fails in Inspector, it's your code."

**Walk the tips:**
> "Return JSON — Claude will format it nicely. Keep results concise — returning 500 rows will hit context limits and confuse Claude. Summarize or paginate. Log every tool call — you want visibility into what Claude is actually asking for."

---

### Slide 14 — Design Patterns (0:49–0:51)

**Say:**
> "Six patterns that separate good MCP servers from frustrating ones. These are SOLID principles applied to the MCP domain."

> "**Validate everything** — Claude generates the parameter values based on what the user said. Treat it like untrusted input."

> "**One tool, one job** — the Single Responsibility Principle. A tool that does five different things based on parameter combinations will have a description so long Claude doesn't know when to use it."

> "**Describe intent** — don't document implementation details in your description. Describe the business scenario the tool solves."

> "**Pagination** — default to returning 10-20 rows. Give Claude a `limit` parameter. It will ask again if it needs more."

---

### Slide 15 — Gotchas (0:51–0:53)

**Say:**
> "Things that will bite you, and how to avoid them."

> "**Vague descriptions** — if Claude keeps asking questions instead of calling your tool, your description isn't specific enough about when to invoke it."

> "**Missing error handling** — when your DB query fails, return `{ isError: true, content: [...] }`. Don't let uncaught exceptions crash the server."

> "**No auth** — anyone who knows your ngrok URL can call your tools. For production, add Bearer token validation. Even in dev, at minimum put a secret in the ngrok config."

> "**stdio vs HTTP** — if you see 'connection refused' in Claude, you're probably running stdio transport. Claude.ai requires Streamable HTTP (the `/mcp` endpoint). If you copy old examples that use `SSEServerTransport` and the `/sse` + `/message` endpoints, they'll still talk to legacy clients but Claude.ai expects the newer transport."

---

### Slide 16 — Hands-On Exercise (0:53–0:58)

**Say:**
> "Your turn. Pick a challenge. The repo has a branch called `exercises` with a stub file and a working example for each."

> "Open `src/tools/` and add a new `server.tool()` call. The DB connection is already there. Write the SQL, return the result. Restart the server and test in Inspector."

> "Five minutes. Go."

**Circulate and help. Watch for:**
- People using `#` in hex colors (not applicable here but...)
- Zod schema mismatches
- Missing `await` on db queries
- Server not restarting (`npm run dev` uses ts-node-dev for hot reload)

**Debrief (2 min):**
> "Who got it working? What did you build? Any surprises?"

---

### Slide 17 — Next Steps (0:58–0:59)

**Say:**
> "Where to go from here."

> "The repo has branches for adding write tools — creating orders — and for deploying to Azure. There's also a branch showing OAuth-based auth for production."

> "The MCP spec is at modelcontextprotocol.io — worth reading the architecture section. The npm SDK has great TypeScript types."

> "For Microsoft shops: there's a Power Platform connector pattern worth exploring — you can expose your MCP server as a Power Automate connector. And Azure API Management can handle auth and rate limiting in front of your MCP server."

---

### Slide 18 — Q&A (0:59–1:00)

**Say:**
> "Repo link is on screen. Questions?"

**Common questions and answers:**

**Q: Can I use this with .NET instead of TypeScript?**
> "Yes — there's a C# SDK: `ModelContextProtocol` on NuGet. Same concepts, different syntax. The repo README has a link."

**Q: Is this secure enough for production data?**
> "With proper auth — yes. Add Bearer token validation, HTTPS (required for Claude.ai), parameterized queries (already there), and run it in a private VNet if needed. It's just an HTTP server."

**Q: Can it write to the database, not just read?**
> "Absolutely. Just add write tools. Best practice: include a `dry_run` parameter that shows what would change without committing, so Claude can confirm with the user first."

**Q: Does this work with Claude API, not just Claude.ai?**
> "Yes — via the tools parameter in the API. You'd handle the tool call loop in your code instead of Claude.ai doing it. More control, more code."

**Q: What about rate limits / cost?**
> "Each tool call is an API call to Claude. Claude.ai Pro/Team handles this within the plan limits. For high-volume production, use the API with monitoring."

---

## Timing Buffer Guide

| Running behind | Cut here |
|---|---|
| 5 min behind | Shorten live demo to 2 examples |
| 10 min behind | Skip Slide 11 (Primitives), shorten demo |
| 15 min behind | Describe the hands-on exercise verbally, skip solo time |

| Running ahead | Add here |
|---|---|
| 5 min ahead | Deeper Q&A on Slide 4 (MCP vs API) |
| 10 min ahead | Show MCP Inspector live during Slide 13 |

---

## Repo Setup Notes for Facilitators

The workshop repo (`mcp-adventureworks`) should have:

```
main           — complete, working solution
starter        — skeleton with TODOs (what attendees clone)
exercises      — stubs + solutions for the 3 challenges
```

Before the workshop, push to `starter` branch and share that URL with attendees. They shouldn't clone `main` — they'd have nothing to build.

---

*Generated for the MCP Server Workshop · Update the GitHub org/repo URL before distributing.*
