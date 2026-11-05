import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(project, "..", "dist");
const target = resolve(project, "www");
if (!existsSync(join(source, "index.local.html"))) {
  throw new Error(`Offline game entry is missing: ${source}`);
}
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true, force: true });
cpSync(join(source, "index.local.html"), join(target, "index.html"), { force: true });
console.log(`Prepared offline iOS web assets in ${target}`);
