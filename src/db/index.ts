import path from "node:path";
import fs from "node:fs";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { seedBaseConfig } from "./seed";

export type Db = NodePgDatabase<typeof schema>;

// Guardado em globalThis: o Next pode carregar este módulo em mais de um bundle no mesmo processo.
const g = globalThis as unknown as { __prumoDb?: Promise<Db> };
const migrationsFolder = path.join(process.cwd(), "src/db/migrations");
export const dataDir = () => process.env.PRUMO_DATA_DIR || path.join(process.cwd(), ".data");

async function connect(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
      import("pg"), import("drizzle-orm/node-postgres"), import("drizzle-orm/node-postgres/migrator"),
    ]);
    db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
    await migrate(db, { migrationsFolder });
  } else {
    if (process.env.NODE_ENV === "production" && !process.env.PRUMO_ALLOW_EMBEDDED_DB) {
      throw new Error("Defina DATABASE_URL em produção: o banco embutido é só para desenvolvimento.");
    }
    const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
      import("@electric-sql/pglite"), import("drizzle-orm/pglite"), import("drizzle-orm/pglite/migrator"),
    ]);
    fs.mkdirSync(dataDir(), { recursive: true });
    const client = new PGlite(path.join(dataDir(), "pg"));
    const pdb = drizzle(client, { schema });
    await migrate(pdb, { migrationsFolder });
    db = pdb as unknown as Db;
  }
  await seedBaseConfig(db);
  return db;
}

export function getDb(): Promise<Db> {
  g.__prumoDb ??= connect().catch((e) => { g.__prumoDb = undefined; throw e; });
  return g.__prumoDb;
}

export { schema };
