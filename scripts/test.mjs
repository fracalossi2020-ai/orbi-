// Roda o Vitest a partir da pasta com a letra do disco em maiúscula.
// No Windows, abrir o projeto pelo VS Code pode trazer "c:\..." minúsculo; o Vitest então carrega o mesmo arquivo
// duas vezes ("c:" e "C:") e todo teste quebra com "Cannot read properties of undefined (reading 'config')".
import { spawnSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd().replace(/^[a-z]:/, (d) => d.toUpperCase());
const bin = path.join(cwd, "node_modules", "vitest", "vitest.mjs");
const r = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { cwd, stdio: "inherit" });
process.exit(r.status ?? 1);
