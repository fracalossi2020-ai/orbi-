import fs from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { dataDir, getDb, schema as s } from "@/db";
import { ApiError, audit, body, route } from "@/server/api";
import { publish, STAFF_CHANNEL, userChannel } from "@/server/bus";
import { cancelRide, completeTrip, markArrived, notify, rateRide, refreshPayment, rideView, startTrip } from "@/server/rides";
import { checkRateLimit } from "@/server/auth";
import { fileHeaders } from "@/server/security";
import { ACTIVE_STATUSES } from "@/domain/transitions";

type P = { id: string; action?: string[] };

async function loadOwned(id: string, userId: string) {
  const db = await getDb();
  const [ride] = await db.select().from(s.rides).where(eq(s.rides.id, id));
  if (!ride) throw new ApiError(404, "Corrida não encontrada.");
  const as = ride.passengerId === userId ? "passenger" : ride.driverId === userId ? "driver" : null;
  if (!as) throw new ApiError(403, "Esta corrida não é sua.");
  return { ride, as: as as "passenger" | "driver" };
}

export const GET = route<P>(async ({ user, params }) => {
  const { ride, as } = await loadOwned(params.id, user.id);
  const action = params.action?.[0];
  if (!action) {
    if (ride.status === "completed" && ride.paymentStatus === "pending") await refreshPayment(ride.id).catch(() => null);
    return rideView(ride, as);
  }
  if (action === "driver-photo" && ride.driverId) {
    const db = await getDb();
    const [doc] = await db.select().from(s.documents).where(and(eq(s.documents.driverId, ride.driverId), eq(s.documents.kind, "selfie"), eq(s.documents.status, "approved")));
    if (!doc) throw new ApiError(404, "Sem foto.");
    const file = await fs.readFile(path.join(dataDir(), "uploads", doc.storedName));
    return new NextResponse(file, { headers: fileHeaders(doc.mime, { "Cache-Control": "private, max-age=600" }) });
  }
  throw new ApiError(404, "Recurso não encontrado.");
});

const cancelSchema = z.object({ reason: z.string().trim().max(300).default("") });
const rateSchema = z.object({ stars: z.number().int().min(1).max(5), note: z.string().trim().max(500).optional() });
const messageSchema = z.object({ body: z.string().trim().min(1, "Escreva a mensagem.").max(500) });

export const POST = route<P>(async ({ req, user, params }) => {
  const { ride, as } = await loadOwned(params.id, user.id);
  const action = params.action?.[0];
  const db = await getDb();
  switch (action) {
    case "cancel": {
      const v = await body(req, cancelSchema);
      await audit(user.id, "ride.cancel", "ride", ride.id, { reason: v.reason });
      return cancelRide(ride.id, user.id, v.reason);
    }
    case "arrive": return markArrived(ride.id, user.id);
    case "start": return startTrip(ride.id, user.id);
    case "complete": {
      const done = await completeTrip(ride.id, user.id);
      await audit(user.id, "ride.complete", "ride", ride.id);
      return done;
    }
    case "rate": {
      const v = await body(req, rateSchema);
      await rateRide(ride.id, user.id, v.stars, v.note);
      return { ok: true };
    }
    case "message": {
      // O chat existe enquanto a corrida está em andamento, entre o passageiro e o motorista dela.
      if (!ACTIVE_STATUSES.includes(ride.status) || !ride.driverId) throw new ApiError(409, "O chat fica disponível só durante a corrida.");
      if (!checkRateLimit(`chat:${user.id}`, 30, 5 * 60_000)) throw new ApiError(429, "Muitas mensagens em pouco tempo. Aguarde um pouco.");
      const v = await body(req, messageSchema);
      await db.insert(s.rideMessages).values({ rideId: ride.id, senderId: user.id, body: v.body });
      const other = as === "passenger" ? ride.driverId : ride.passengerId;
      publish(userChannel(user.id), "ride");
      if (other) publish(userChannel(other), "ride");
      return { ok: true };
    }
    case "emergency": {
      if (!checkRateLimit(`sos:${user.id}:${ride.id}`, 5, 10 * 60_000)) return { ok: true, repeated: true };
      const [ticket] = await db.insert(s.tickets).values({
        userId: user.id, rideId: ride.id, kind: "emergencia", priority: "critical", subject: "Alerta de emergência em corrida",
        body: `Acionado por ${as === "passenger" ? "passageiro" : "motorista"} durante a corrida.`,
      }).returning();
      await audit(user.id, "ride.emergency", "ride", ride.id, { ticket: ticket.id });
      const staff = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "atendente"));
      for (const a of staff) await notify(db, a.id, "Emergência em corrida", `Chamado crítico aberto na corrida ${ride.id.slice(0, 8)}.`, "/admin/chamados");
      publish(STAFF_CHANNEL, "ticket");
      return { ok: true, ticketId: ticket.id };
    }
    default: throw new ApiError(404, "Ação desconhecida.");
  }
});
