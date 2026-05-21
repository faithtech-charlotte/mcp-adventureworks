import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import type { ConnectionPool } from "mssql";

export function registerProductTools(server: McpServer, db: ConnectionPool): void {

  // ── Tool 1: Search products ────────────────────────────────────────────────
  server.registerTool(
    "products_search",
    {
      description: `Search AdventureWorks products by name, color, or category.
     Use when the user asks about product listings, catalog, or wants to find specific items.
     Returns product name, number, list price, color, size, and stock levels.`,
      inputSchema: z.object({
        query:    z.string().describe("Search term to match against product name or number"),
        color:    z.string().optional().describe("Filter by color (e.g. 'Red', 'Black', 'Silver')"),
        category: z.string().optional().describe("Filter by category name (e.g. 'Bikes', 'Components')"),
        limit:    z.number().int().min(1).max(100).default(10).describe("Maximum number of results to return"),
      }),
    },
    async ({ query, color, category, limit }: { query: string; color?: string; category?: string; limit: number }) => {
      try {
        const request = db.request();
        request.input("query",    `%${query}%`);
        request.input("limit",    limit);
        request.input("color",    color ?? null);
        request.input("category", category ? `%${category}%` : null);

        const result = await request.query(`
          SELECT TOP (@limit)
            p.ProductID,
            p.Name,
            p.ProductNumber,
            p.Color,
            p.Size,
            p.ListPrice,
            p.SafetyStockLevel,
            p.ReorderPoint,
            p.StandardCost,
            ISNULL(pi.Quantity, 0) AS StockQuantity,
            pc.Name AS Category,
            psc.Name AS Subcategory
          FROM Production.Product p
          LEFT JOIN Production.ProductInventory pi ON p.ProductID = pi.ProductID AND pi.LocationID = 1
          LEFT JOIN Production.ProductSubcategory psc ON p.ProductSubcategoryID = psc.ProductSubcategoryID
          LEFT JOIN Production.ProductCategory pc ON psc.ProductCategoryID = pc.ProductCategoryID
          WHERE p.Name LIKE @query
            AND (@color IS NULL OR p.Color = @color)
            AND (@category IS NULL OR pc.Name LIKE @category)
            AND p.FinishedGoodsFlag = 1
          ORDER BY p.Name
        `);

        if (result.recordset.length === 0) {
          return { content: [{ type: "text", text: "No products found matching your criteria." }] };
        }

        console.log(query, JSON.stringify(result.recordset));
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result.recordset, null, 2),
          }],
        };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Database error: ${(err as Error).message}` }] };
      }
    }
  );

  // ── Tool 2: Products below reorder point ──────────────────────────────────
  server.registerTool(
    "products_reorder_list",
    {
      description: `Get a list of products that are at or below their reorder point (safety stock level).
     Use when the user asks about reordering, low stock, inventory alerts, or replenishment needs.
     Returns products sorted by how urgently they need reordering.`,
      inputSchema: z.object({
        category: z.string().optional().describe("Filter to a specific category (e.g. 'Bikes')"),
        limit:    z.number().int().min(1).max(100).default(20).describe("Maximum results"),
      }),
    },
    async ({ category, limit }: { category?: string; limit: number }) => {
      try {
        const request = db.request();
        request.input("limit", limit);
        request.input("category", category ? `%${category}%` : null);

        const result = await request.query(`
          SELECT TOP (@limit)
            p.ProductID,
            p.Name,
            p.ProductNumber,
            ISNULL(pi.Quantity, 0) AS CurrentStock,
            p.ReorderPoint,
            p.SafetyStockLevel,
            p.ListPrice,
            pc.Name AS Category
          FROM Production.Product p
          LEFT JOIN Production.ProductInventory pi ON p.ProductID = pi.ProductID AND pi.LocationID = 1
          LEFT JOIN Production.ProductSubcategory psc ON p.ProductSubcategoryID = psc.ProductSubcategoryID
          LEFT JOIN Production.ProductCategory pc ON psc.ProductCategoryID = pc.ProductCategoryID
          WHERE ISNULL(pi.Quantity, 0) <= p.ReorderPoint
            AND p.FinishedGoodsFlag = 1
            AND (@category IS NULL OR pc.Name LIKE @category)
          ORDER BY (ISNULL(pi.Quantity, 0) - p.ReorderPoint) ASC
        `);

        return {
          content: [{
            type: "text",
            text: result.recordset.length === 0
              ? "No products currently below reorder point."
              : JSON.stringify(result.recordset, null, 2),
          }],
        };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Database error: ${(err as Error).message}` }] };
      }
    }
  );
}
