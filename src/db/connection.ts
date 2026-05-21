import sql from "mssql";
import "dotenv/config";

const config: sql.config = {
  server: process.env.DB_SERVER ?? "localhost",
  port: parseInt(process.env.DB_PORT ?? "1433", 10),
  user: process.env.DB_USER ?? "sa",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE ?? "AdventureWorks",
  options: {
    trustServerCertificate: true, // Docker SA account uses self-signed cert
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30_000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  pool = await sql.connect(config);
  console.log("✅  Connected to AdventureWorks");
  return pool;
}

export { sql };
