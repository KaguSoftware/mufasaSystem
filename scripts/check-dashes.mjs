// Fails if any tracked/working file contains an em dash (U+2014). Project rule, see CLAUDE.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const EM = String.fromCharCode(0x2014);
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "out", "render-output", "coverage"]);
const TEXT = /\.(ts|tsx|js|mjs|cjs|json|md|css|sql|yaml|yml|html|txt|env|example)$/i;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (TEXT.test(name) || name.startsWith(".env")) {
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (line.includes(EM)) hits.push(`${p}:${i + 1}`);
      });
    }
  }
}

walk(process.cwd());
if (hits.length) {
  console.error(`Em dashes found (project rule: zero em dashes):\n${hits.join("\n")}`);
  process.exit(1);
}
console.log("No em dashes.");
