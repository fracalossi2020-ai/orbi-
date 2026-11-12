import { STAFF_CHANNEL, subscribe, userChannel } from "@/server/bus";
import { publicRoute, ApiError } from "@/server/api";
import { STAFF } from "@/domain/permissions";

export const dynamic = "force-dynamic";

/** Canal SSE por usuário: avisa que algo mudou; o cliente busca o estado de novo. */
export const GET = publicRoute(async ({ req, user }) => {
  if (!user) throw new ApiError(401, "Entre na sua conta para continuar.");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (topic: string) => {
        try { controller.enqueue(encoder.encode(`data: ${topic}\n\n`)); } catch { /* conexão encerrada */ }
      };
      send("hello");
      const unsubs = [subscribe(userChannel(user.id), send)];
      if (STAFF.includes(user.role)) unsubs.push(subscribe(STAFF_CHANNEL, send));
      const ping = setInterval(() => send("ping"), 25000);
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubs.forEach((u) => u());
        try { controller.close(); } catch { /* já fechada */ }
      });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
});
