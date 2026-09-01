/*
 * Rebuilds and serves dist/ on the local network, so the app can be opened on
 * a real phone over Wi-Fi rather than only in a desktop browser.
 *
 * Usage: npm run dev
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const port = Number(process.env.PORT ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ics": "text/calendar; charset=utf-8",
};

async function resolveFile(urlPath) {
  // normalize collapses any ".." before it can climb out of dist/.
  const relativePath = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const candidate = join(root, relativePath);
  if (!candidate.startsWith(root)) return null;

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) return resolveFile(join(relativePath, "index.html"));
    return candidate;
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const file = (await resolveFile(url.pathname)) ?? (await resolveFile("/index.html"));

  if (!file) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Run `npm run build` first.");
    return;
  }

  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    // The point of running this is to see edits, so nothing is held onto.
    "cache-control": "no-store",
  });
  createReadStream(file).pipe(response);
});

function addresses() {
  const found = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push(entry.address);
    }
  }
  return found;
}

server.listen(port, () => {
  console.log(`Stork is serving dist/ on:\n  http://localhost:${port}`);
  for (const address of addresses()) console.log(`  http://${address}:${port}`);
  console.log(
    "\nOpen one of the network addresses on your phone, on the same Wi-Fi.\n" +
      "Note: iOS only offers Add to Home Screen over https, so use the deployed\n" +
      "URL for the real thing and this for quick checks.",
  );
});
