// Generates public/obits.json so the site can be served as a fully static
// bundle (e.g. on GitHub Pages) with no running server. Run by the deploy
// workflow on a schedule so the baked-in data stays fresh.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getFeed } from "../lib/feed.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, "..", "public", "obits.json");

const payload = await getFeed({ force: true });
await writeFile(out, JSON.stringify(payload));

console.log(
  `Wrote ${out} — source=${payload.source}, listings=${payload.count}` +
    (payload.error ? `, note="${payload.error}"` : "")
);
