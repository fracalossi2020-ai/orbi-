import { cookies } from "next/headers";
import { getDb } from "@/db";
import { getSetting } from "@/db/seed";
import { currentUser } from "@/server/auth";
import { can } from "@/domain/permissions";
import { IdentityBoard } from "@/components/site/IdentityBoard";

export const metadata = { title: "Identidade visual" };

export default async function Identidade() {
  const db = await getDb();
  const official = await getSetting(db, "identity", "a");
  const preview = (await cookies()).get("prumo_identity_preview")?.value ?? null;
  const user = await currentUser();
  return <IdentityBoard official={official} preview={preview} canSetOfficial={!!user && can(user.role, "settings", "write")} />;
}
