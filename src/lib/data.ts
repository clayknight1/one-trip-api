import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const client = postgres(process.env.DATABASE_URL!, {
  ssl: { rejectUnauthorized: false },
  connect_timeout: 10,
  idle_timeout: 20,
  max: 10,
});

const db = drizzle(client, { schema });

export default db;
