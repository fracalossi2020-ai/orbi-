/**
 * Cria a primeira conta administrativa. Pare o servidor antes se estiver usando o banco embutido.
 * Uso: npm run admin:create -- "Nome" email@empresa.com [admin|gestor|atendente]
 * A senha é gerada aqui e aparece uma única vez.
 */
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { getDb, schema as s } from "../src/db";

const scrypt = promisify(scryptCb) as (p: string, salt: Buffer, len: number) => Promise<Buffer>;

async function main() {
  const [name, email, role = "admin"] = process.argv.slice(2);
  if (!name || !email || !["admin", "gestor", "atendente"].includes(role)) {
    console.error('Uso: npm run admin:create -- "Nome" email@empresa.com [admin|gestor|atendente]');
    process.exit(1);
  }
  const password = process.env.PRUMO_ADMIN_PASSWORD || randomBytes(12).toString("base64url");
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  const db = await getDb();
  await db.insert(s.users).values({
    name, email: email.toLowerCase(), role: role as "admin", passwordHash: `${salt.toString("hex")}:${key.toString("hex")}`, privacyAcceptedAt: new Date(),
  });
  console.log(`\nConta criada: ${email} (${role})\nSenha: ${password}\nGuarde agora: ela não será mostrada de novo.\n`);
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
