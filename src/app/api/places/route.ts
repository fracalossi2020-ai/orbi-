import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { ApiError, body, route } from "@/server/api";

const MAX_OTHER = 10;
const NAME: Record<string, string> = { home: "Casa", work: "Trabalho" };

const saveSchema = z.object({
  kind: z.enum(["home", "work", "other"]),
  name: z.string().trim().max(40).optional(),
  label: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(300).nullish(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const view = (p: typeof s.savedPlaces.$inferSelect) => ({ id: p.id, kind: p.kind, name: p.name, label: p.label, detail: p.detail, lat: p.lat, lng: p.lng });

export const GET = route(async ({ user }) => {
  const db = await getDb();
  const rows = await db.select().from(s.savedPlaces).where(eq(s.savedPlaces.userId, user.id)).orderBy(asc(s.savedPlaces.createdAt));
  return { places: rows.map(view) };
}, { roles: ["passenger"] });

/** Casa e trabalho são substituídos ao salvar de novo; os outros precisam de nome. */
export const POST = route(async ({ req, user }) => {
  const v = await body(req, saveSchema);
  const name = v.kind === "other" ? v.name : NAME[v.kind];
  if (!name) throw new ApiError(400, "Dê um nome para este local.");
  const db = await getDb();
  const values = { userId: user.id, kind: v.kind, name, label: v.label, detail: v.detail ?? null, lat: v.lat, lng: v.lng };
  if (v.kind !== "other") {
    const [existing] = await db.select({ id: s.savedPlaces.id }).from(s.savedPlaces).where(and(eq(s.savedPlaces.userId, user.id), eq(s.savedPlaces.kind, v.kind)));
    if (existing) {
      const [row] = await db.update(s.savedPlaces).set(values).where(eq(s.savedPlaces.id, existing.id)).returning();
      return view(row);
    }
  } else {
    const others = await db.select({ id: s.savedPlaces.id }).from(s.savedPlaces).where(and(eq(s.savedPlaces.userId, user.id), eq(s.savedPlaces.kind, "other")));
    if (others.length >= MAX_OTHER) throw new ApiError(409, `Você pode salvar até ${MAX_OTHER} outros locais. Apague um para salvar este.`);
  }
  const [row] = await db.insert(s.savedPlaces).values(values).returning();
  return view(row);
}, { roles: ["passenger"] });

export const DELETE = route(async ({ req, user }) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(400, "Local inválido.");
  const db = await getDb();
  const [row] = await db.delete(s.savedPlaces).where(and(eq(s.savedPlaces.id, id), eq(s.savedPlaces.userId, user.id))).returning();
  if (!row) throw new ApiError(404, "Local não encontrado.");
  return { ok: true };
}, { roles: ["passenger"] });
