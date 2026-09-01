/*
 * Builds the static site into dist/ with nothing installed.
 *
 * TypeScript is erased by Node's own stripper rather than compiled, so the
 * output is the same source the tests run against, minus the types. Relative
 * imports are rewritten from .ts to .js so a browser can follow them natively.
 *
 * Usage: npm run build
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { renderIcon } from "./icon.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src");
const webDir = join(root, "web");
const outDir = join(root, "dist");

const ICONS = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

/** Relative specifiers only: bare imports would not be ours to rewrite. */
const TS_SPECIFIER = /(['"])(\.[^'"]+)\.ts\1/g;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function emitModules() {
  const sources = (await walk(srcDir)).filter((file) => file.endsWith(".ts"));
  const emitted = [];

  for (const file of sources) {
    const source = await readFile(file, "utf8");
    // Throws with a real position if the source does not parse, which makes
    // this the syntax check as well as the transform.
    const stripped = stripTypeScriptTypes(source, { mode: "strip" });

    const outPath = join(outDir, relative(srcDir, file).replace(/\.ts$/, ".js"));
    const deps = [];
    const code = stripped.replace(TS_SPECIFIER, (_match, quote, path) => {
      deps.push(resolve(dirname(outPath), `${path}.js`));
      return `${quote}${path}.js${quote}`;
    });

    if (/(['"])\.[^'"]+\.ts\1/.test(code)) {
      throw new Error(`${relative(root, file)} still refers to a .ts file`);
    }

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, code);
    emitted.push({ outPath, deps });
  }

  return emitted;
}

/**
 * A rewritten import that points at nothing produces a blank screen and a
 * console error nobody will see on a phone, so the graph is checked here.
 */
function verifyImports(modules) {
  const present = new Set(modules.map((module) => module.outPath));

  for (const { outPath, deps } of modules) {
    for (const dep of deps) {
      if (!present.has(dep)) {
        throw new Error(
          `${relative(outDir, outPath)} imports ${relative(outDir, dep)}, which was not emitted`,
        );
      }
    }
  }
}

/**
 * Rewriting import specifiers by hand is cheap but blunt, and a broken graph
 * shows up as a blank screen on a phone with no console in sight. So the whole
 * emitted bundle is loaded once, through the same DOM stub the tests use, to
 * prove it at least evaluates before anyone deploys it.
 */
async function verifyBundleLoads() {
  const { installDom } = await import("./dom-stub.mjs");
  const restore = installDom();
  try {
    await import(pathToFileURL(join(outDir, "main.js")).href);
  } catch (error) {
    throw new Error(`the built bundle failed to load: ${error.message}`, { cause: error });
  } finally {
    restore();
  }
}

async function copyWeb() {
  const copied = [];
  for (const name of await readdir(webDir)) {
    // The worker is written last, once there is something to list inside it.
    if (name === "sw.js") continue;
    const contents = await readFile(join(webDir, name));
    await writeFile(join(outDir, name), contents);
    copied.push(name);
  }
  return copied;
}

async function drawIcons() {
  for (const icon of ICONS) {
    await writeFile(join(outDir, icon.file), renderIcon(icon.size, { maskable: icon.maskable }));
  }
  return ICONS.map((icon) => icon.file);
}

/** Every asset is precached, because the whole app is only a few dozen kB. */
async function writeServiceWorker(assets) {
  const hash = createHash("sha256");
  for (const name of [...assets].sort()) {
    hash.update(name);
    hash.update(await readFile(join(outDir, name)));
  }
  const buildId = hash.digest("hex").slice(0, 12);

  const precache = ["./", ...assets.map((name) => `./${name}`)];
  const template = await readFile(join(webDir, "sw.js"), "utf8");
  const worker = template
    .replace("__BUILD_ID__", buildId)
    .replace("__PRECACHE__", JSON.stringify(precache, null, 2));

  if (worker.includes("__BUILD_ID__") || worker.includes("__PRECACHE__")) {
    throw new Error("service worker placeholders were not filled in");
  }

  await writeFile(join(outDir, "sw.js"), worker);
  return buildId;
}

async function verifyHtml(assets) {
  const html = await readFile(join(outDir, "index.html"), "utf8");
  for (const [, href] of html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)) {
    if (!assets.includes(href)) {
      throw new Error(`index.html references ./${href}, which is not in the build`);
    }
  }
}

async function main() {
  if (typeof stripTypeScriptTypes !== "function") {
    throw new Error("This build needs Node 22.13 or newer for its TypeScript stripper.");
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const modules = await emitModules();
  verifyImports(modules);
  await verifyBundleLoads();

  const copied = await copyWeb();
  const icons = await drawIcons();

  const assets = [
    ...modules.map(({ outPath }) => relative(outDir, outPath).replaceAll("\\", "/")),
    ...copied,
    ...icons,
  ];

  await verifyHtml(assets);
  const buildId = await writeServiceWorker(assets);

  const bytes = (
    await Promise.all(assets.map(async (name) => (await readFile(join(outDir, name))).length))
  ).reduce((total, size) => total + size, 0);

  console.log(`Built ${assets.length} files (${(bytes / 1024).toFixed(1)} kB) into dist/`);
  console.log(`Service worker build id: ${buildId}`);
}

await main();
