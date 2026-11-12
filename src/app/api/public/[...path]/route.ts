import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { getDb, schema as s } from "@/db";
import { ApiError, audit, body, publicRoute } from "@/server/api";
import { checkRateLimit } from "@/server/auth";
import { clientIp } from "@/server/security";
import { rideView } from "@/server/rides";
import { publish, STAFF_CHANNEL } from "@/server/bus";
import { can } from "@/domain/permissions";
import { isValidBrPhone } from "@/domain/validation";
import { emailDomainExists } from "@/server/verify";
import { NextResponse } from "next/server";
import { publicPulse, publicSupport, publicTariffs } from "@/server/public-data";
import { getSetting } from "@/db/seed";
import { DEFAULT_DRIVER_RULES, type DriverRules, withDefaultRules } from "@/domain/driver-rules";

type P = { path: string[] };

const LIVE: string[] = ["searching", "accepted", "arrived", "in_progress"];

export const GET = publicRoute<P>(async ({ params }) => {
  const [what, arg] = params.path;
  // Dados abertos do site: tarifas do painel, motoristas online por cidade (só a contagem) e contato do atendimento.
  const cache = (data: unknown, seconds: number) => NextResponse.json(data, { headers: { "Cache-Control": `public, max-age=${seconds}` } });
  if (what === "tariffs") return cache({ cities: await publicTariffs() }, 60);
  if (what === "pulse") return cache({ cities: await publicPulse() }, 20);
  if (what === "support") return cache(await publicSupport(), 300);
  if (what === "driver-rules") return cache(await getSetting<Partial<DriverRules>>(await getDb(), "driverRules", DEFAULT_DRIVER_RULES).then(withDefaultRules), 300);
  if (what === "share" && arg) {
    const db = await getDb();
    const [ride] = await db.select().from(s.rides).where(eq(s.rides.shareToken, arg));
    if (!ride) throw new ApiError(404, "Este link de viagem não existe.");
    // Encerrada a corrida, o link deixa de expor rota e motorista.
    if (!LIVE.includes(ride.status)) return { ended: true, status: ride.status };
    return rideView(ride, "share");
  }
  throw new ApiError(404, "Recurso não encontrado.");
});

const leadSchema = z.object({
  kind: z.enum(["passageiro", "motorista", "parceiro", "contato"]),
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  phone: z.string().trim().max(30).refine((v) => !v || isValidBrPhone(v), "Telefone inválido: use DDD e número.").optional(),
  city: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true, { error: "Autorize o contato para enviar." }),
});
const identitySchema = z.object({ identity: z.enum(["a", "b", "c", "d"]), official: z.boolean().default(false) });

export const POST = publicRoute<P>(async ({ req, user, params }) => {
  const [what] = params.path;
  const db = await getDb();
  if (what === "leads") {
    if (!checkRateLimit(`lead:${clientIp(req)}`, 10, 60 * 60_000)) throw new ApiError(429, "Muitos envios. Tente de novo mais tarde.");
    const v = await body(req, leadSchema);
    if (!(await emailDomainExists(v.email))) throw new ApiError(400, "Este e-mail não pode receber mensagens. Confira o que digitou.");
    await db.insert(s.leads).values(v);
    publish(STAFF_CHANNEL, "lead");
    return { ok: true };
  }
  if (what === "identity") {
    const v = await body(req, identitySchema);
    if (v.official) {
      if (!user || !can(user.role, "settings", "write")) throw new ApiError(403, "Só administradores definem a identidade oficial.");
      await db.insert(s.settings).values({ key: "identity", value: v.identity }).onConflictDoUpdate({ target: s.settings.key, set: { value: v.identity } });
      await audit(user.id, "identity.set", "settings", "identity", { identity: v.identity });
      (await cookies()).delete("prumo_identity_preview");
    } else {
      (await cookies()).set("prumo_identity_preview", v.identity, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    }
    return { ok: true };
  }
  throw new ApiError(404, "Ação desconhecida.");
});
