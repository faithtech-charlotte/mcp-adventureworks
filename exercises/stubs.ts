/**
 * Workshop Exercise Stubs
 *
 * Add your tools here during the hands-on section.
 * Register them in server.ts by importing and calling registerExerciseTools().
 *
 * Challenges:
 *   1. STARTER      — List products in a subcategory with list price
 *   2. INTERMEDIATE — Top N salespeople by revenue for a date range
 *   3. ADVANCED     — Customers at churn risk (inactive for X days, previously active)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ConnectionPool } from "mssql";

export function registerExerciseTools(server: McpServer, db: ConnectionPool): void {

  // ─────────────────────────────────────────────────────────────────────────
  // CHALLENGE 1 — STARTER
  // List all products in a given subcategory with their current list price.
  //
  // Useful tables:
  //   Production.Product          (Name, ListPrice, ProductSubcategoryID)
  //   Production.ProductSubcategory (Name, ProductCategoryID)
  //   Production.ProductCategory  (Name)
  //
  // TODO: Uncomment and complete this tool.
  // ─────────────────────────────────────────────────────────────────────────
  //
  // server.tool(
  //   "products_by_subcategory",
  //   `<TODO: write a description that tells Claude when to use this tool>`,
  //   {
  //     subcategory: z.string().describe("Subcategory name (e.g. 'Mountain Bikes', 'Gloves')"),
  //   },
  //   async ({ subcategory }) => {
  //     try {
  //       const request = db.request();
  //       // TODO: add your input params and query
  //       const result = await request.query(`/* TODO */`);
  //       return { content: [{ type: "text", text: JSON.stringify(result.recordset, null, 2) }] };
  //     } catch (err) {
  //       return { isError: true, content: [{ type: "text", text: (err as Error).message }] };
  //     }
  //   }
  // );


  // ─────────────────────────────────────────────────────────────────────────
  // CHALLENGE 2 — INTERMEDIATE
  // Show the top N salespeople by total revenue for a given date range.
  //
  // Useful tables:
  //   Sales.SalesOrderHeader      (SalesPersonID, TotalDue, OrderDate)
  //   Sales.SalesPerson           (SalesPersonID, SalesQuota)
  //   HumanResources.Employee     (BusinessEntityID, JobTitle)
  //   Person.Person               (BusinessEntityID, FirstName, LastName)
  //
  // TODO: Uncomment and complete this tool.
  // ─────────────────────────────────────────────────────────────────────────
  //
  // server.tool(
  //   "sales_top_salespeople",
  //   `<TODO>`,
  //   {
  //     startDate: z.string().describe("Start date (YYYY-MM-DD)"),
  //     endDate:   z.string().describe("End date (YYYY-MM-DD)"),
  //     limit:     z.number().int().min(1).max(50).default(10),
  //   },
  //   async ({ startDate, endDate, limit }) => {
  //     // TODO
  //   }
  // );


  // ─────────────────────────────────────────────────────────────────────────
  // CHALLENGE 3 — ADVANCED
  // Identify customers at risk of churn: no orders in X days but had multiple
  // orders in the prior 12 months (i.e., previously engaged).
  //
  // Useful tables:
  //   Sales.Customer              (CustomerID, PersonID)
  //   Sales.SalesOrderHeader      (CustomerID, OrderDate, TotalDue)
  //   Person.Person               (BusinessEntityID, FirstName, LastName)
  //
  // Hint: Use two CTEs — one for last order date, one for order count in the
  //       prior 12 months — then join and filter.
  //
  // TODO: Uncomment and complete this tool.
  // ─────────────────────────────────────────────────────────────────────────
  //
  // server.tool(
  //   "customers_churn_risk",
  //   `<TODO>`,
  //   {
  //     inactiveDays:    z.number().int().min(1).default(180),
  //     minPriorOrders:  z.number().int().min(1).default(2),
  //     limit:           z.number().int().min(1).max(100).default(25),
  //   },
  //   async ({ inactiveDays, minPriorOrders, limit }) => {
  //     // TODO
  //   }
  // );
}
