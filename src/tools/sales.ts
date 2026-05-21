import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import type { ConnectionPool } from "mssql";

export function registerSalesTools(server: McpServer, db: ConnectionPool): void {

  // ── Tool 1: Top selling products ──────────────────────────────────────────
  server.registerTool(
    "sales_top_products",
    {
      description: `Get the top selling products by total revenue or quantity sold for a given time period.
     Use when the user asks about best sellers, top products, most popular items, or sales performance.
     Returns product name, units sold, total revenue, and rank.`,
      inputSchema: z.object({
        year:   z.number().int().min(2001).max(2025).optional().describe("Filter by year (e.g. 2013). Omit for all time."),
        limit:  z.number().int().min(1).max(50).default(10).describe("Number of top products to return"),
        sortBy: z.enum(["revenue", "quantity"]).default("revenue").describe("Sort by total revenue or units sold"),
      }),
    },
    async ({ year, limit, sortBy }) => {
      try {
        const request = db.request();
        request.input("year",  year ?? null);
        request.input("limit", limit);

        const orderCol = sortBy === "quantity" ? "TotalQuantity" : "TotalRevenue";

        const result = await request.query(`
          SELECT TOP (@limit)
            p.Name AS ProductName,
            p.ProductNumber,
            SUM(sod.OrderQty) AS TotalQuantity,
            SUM(sod.LineTotal) AS TotalRevenue,
            pc.Name AS Category
          FROM Sales.SalesOrderDetail sod
          JOIN Sales.SalesOrderHeader soh ON sod.SalesOrderID = soh.SalesOrderID
          JOIN Production.Product p ON sod.ProductID = p.ProductID
          LEFT JOIN Production.ProductSubcategory psc ON p.ProductSubcategoryID = psc.ProductSubcategoryID
          LEFT JOIN Production.ProductCategory pc ON psc.ProductCategoryID = pc.ProductCategoryID
          WHERE (@year IS NULL OR YEAR(soh.OrderDate) = @year)
          GROUP BY p.ProductID, p.Name, p.ProductNumber, pc.Name
          ORDER BY ${orderCol} DESC
        `);

        return { content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Database error: ${(err as Error).message}` }] };
      }
    }
  );

  // ── Tool 2: Sales by territory ────────────────────────────────────────────
  server.registerTool(
    "sales_by_territory",
    {
      description: `Get total sales revenue and order count broken down by sales territory.
     Use when the user asks about regional sales, territory performance, or geographic breakdown.
     Can filter by year. Returns territory name, country/region, order count, and total revenue.`,
      inputSchema: z.object({
        year:    z.number().int().min(2001).max(2025).optional().describe("Filter by year"),
        quarter: z.number().int().min(1).max(4).optional().describe("Filter by quarter (1-4)"),
      }),
    },
    async ({ year, quarter }) => {
      try {
        const request = db.request();
        request.input("year",    year ?? null);
        request.input("quarter", quarter ?? null);

        const result = await request.query(`
          SELECT
            st.Name AS Territory,
            st.CountryRegionCode AS Country,
            st.[Group] AS Region,
            COUNT(DISTINCT soh.SalesOrderID) AS OrderCount,
            SUM(soh.TotalDue) AS TotalRevenue,
            AVG(soh.TotalDue) AS AverageOrderValue
          FROM Sales.SalesOrderHeader soh
          JOIN Sales.SalesTerritory st ON soh.TerritoryID = st.TerritoryID
          WHERE (@year IS NULL OR YEAR(soh.OrderDate) = @year)
            AND (@quarter IS NULL OR DATEPART(QUARTER, soh.OrderDate) = @quarter)
          GROUP BY st.TerritoryID, st.Name, st.CountryRegionCode, st.[Group]
          ORDER BY TotalRevenue DESC
        `);

        return { content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Database error: ${(err as Error).message}` }] };
      }
    }
  );

  // ── Tool 3: Inactive customers ────────────────────────────────────────────
  server.registerTool(
    "sales_inactive_customers",
    {
      description: `Find customers who have not placed an order within a specified number of days.
     Use when the user asks about churn, lapsed customers, re-engagement opportunities,
     or customers who haven't ordered recently.
     Returns customer name, last order date, total lifetime value, and days since last order.`,
      inputSchema: z.object({
        daysSinceOrder: z.number().int().min(1).default(180).describe("Number of days of inactivity threshold"),
        limit:          z.number().int().min(1).max(100).default(20).describe("Maximum results"),
      }),
    },
    async ({ daysSinceOrder, limit }) => {
      try {
        const request = db.request();
        request.input("days",  daysSinceOrder);
        request.input("limit", limit);

        const result = await request.query(`
          SELECT TOP (@limit)
            c.CustomerID,
            p.FirstName + ' ' + p.LastName AS CustomerName,
            ea.EmailAddress,
            MAX(soh.OrderDate) AS LastOrderDate,
            DATEDIFF(DAY, MAX(soh.OrderDate), GETDATE()) AS DaysSinceLastOrder,
            COUNT(soh.SalesOrderID) AS TotalOrders,
            SUM(soh.TotalDue) AS LifetimeValue
          FROM Sales.Customer c
          JOIN Person.Person p ON c.PersonID = p.BusinessEntityID
          LEFT JOIN Person.EmailAddress ea ON p.BusinessEntityID = ea.BusinessEntityID
          JOIN Sales.SalesOrderHeader soh ON c.CustomerID = soh.CustomerID
          GROUP BY c.CustomerID, p.FirstName, p.LastName, ea.EmailAddress
          HAVING MAX(soh.OrderDate) < DATEADD(DAY, -@days, GETDATE())
          ORDER BY DaysSinceLastOrder DESC
        `);

        return { content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }] };
      } catch (err) {
        return { isError: true, content: [{ type: "text", text: `Database error: ${(err as Error).message}` }] };
      }
    }
  );
}
