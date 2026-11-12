import { eq, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { ApiError, assertCan, audit, route } from "@/server/api";
import { RESOURCES } from "@/server/admin-resources";
import { STAFF } from "@/domain/permissions";

type P = { resource: string; id?: string[] };
const roles = { roles: STAFF };

function resolve(name: string) {
  const def = RESOURCES[name];
  if (!def) throw new ApiError(404, "Recurso não encontrado.");
  return def;
}
const whereId = (table: unknown, id: string) => eq((table as { id: never }).id, id as never) as SQL;

async function parse(req: Request, schema: { parse: (v: unknown) => Record<string, unknown> }) {
  let json: unknown;
  try { json = await req.json(); } catch { throw new ApiError(400, "Corpo do pedido inválido."); }
  return schema.parse(json);
}

export const GET = route<P>(async ({ user, params }) => {
  const def = resolve(params.resource);
  assertCan(user, def.permission, "read");
  const db = await getDb();
  const q = db.select().from(def.table as never);
  return { rows: await (def.order ? q.orderBy(def.order as SQL).limit(300) : q.limit(300)) };
}, roles);

export const POST = route<P>(async ({ req, user, params }) => {
  const def = resolve(params.resource);
  assertCan(user, def.permission, "write");
  if (!def.create) throw new ApiError(405, "Este recurso não aceita criação.");
  const values = await parse(req, def.create);
  const db = await getDb();
  const [row] = (await db.insert(def.table as never).values(values as never).returning()) as unknown as { id: string }[];
  await audit(user.id, `${params.resource}.create`, params.resource, row.id);
  return row;
}, roles);

export const PATCH = route<P>(async ({ req, user, params }) => {
  const def = resolve(params.resource);
  assertCan(user, def.permission, "write");
  const id = params.id?.[0];
  if (!def.update || !id) throw new ApiError(405, "Este recurso não aceita edição.");
  const values = await parse(req, def.update);
  const db = await getDb();
  const [row] = (await db.update(def.table as never).set(values as never).where(whereId(def.table, id)).returning()) as unknown as { id: string }[];
  if (!row) throw new ApiError(404, "Registro não encontrado.");
  await audit(user.id, `${params.resource}.update`, params.resource, id, { fields: Object.keys(values) });
  return row;
}, roles);

export const DELETE = route<P>(async ({ user, params }) => {
  const def = resolve(params.resource);
  assertCan(user, def.permission, "write");
  const id = params.id?.[0];
  if (!def.remove || !id) throw new ApiError(405, "Este recurso não aceita exclusão.");
  const db = await getDb();
  await db.delete(def.table as never).where(whereId(def.table, id));
  await audit(user.id, `${params.resource}.delete`, params.resource, id);
  return { ok: true };
}, roles);
