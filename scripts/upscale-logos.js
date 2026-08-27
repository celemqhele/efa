#!/usr/bin/env node

/**
 * Batch-upscale football team logos + EFA brand logos using Real-ESRGAN.
 *
 * Pipeline per logo:
 *   1. AI-upscale 700×700 → 1400×1400  (Real-ESRGAN NCNN Vulkan, 2×)
 *   2. Copy alpha from original          (sharp raw buffers)
 *   3. Resize to 640, 1280, 2560        (sharp – browser downscales at render)
 *   4. Overwrite existing folder sizes
 *
 * Usage:
 *   node scripts/upscale-logos.js                        # all leagues
 *   node scripts/upscale-logos.js --test                 # first league only
 *   node scripts/upscale-logos.js --league "english-premier-league"
 *   node scripts/upscale-logos.js --efa-only             # EFA brand logos only
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const LOGOS_DIR = path.join(ROOT, "public", "logos");
const EFA_DIR = path.join(ROOT, "public");
const UPSCAYL_EXE = path.join(__dirname, "upscayl", "realesrgan-ncnn-vulkan.exe");
const TEMP_DIR = path.join(__dirname, "upscayl", "temp");

const OUTPUT_SIZES = [640, 1280, 2560];

const args = process.argv.slice(2);
const testMode = args.includes("--test");
const efaOnly = args.includes("--efa-only");
const skipExisting = args.includes("--skip-existing");
const leagueArg = args.includes("--league") ? args[args.indexOf("--league") + 1] : null;

function log(msg) {
  console.log(`[upscale] ${msg}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getLeagueFolders() {
  return fs
    .readdirSync(LOGOS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.includes("football-logos.cc"))
    .map((e) => e.name)
    .sort();
}

function getTeamLogos(leagueFolder) {
  const srcDir = path.join(LOGOS_DIR, leagueFolder, "700x700");
  if (!fs.existsSync(srcDir)) return [];
  return fs.readdirSync(srcDir).filter((f) => f.endsWith(".png")).sort();
}

function upscaleWithRealESRGAN(inputPath, outputPath) {
  const cmd = `"${UPSCAYL_EXE}" -i "${inputPath}" -o "${outputPath}" -n realesrgan-x4plus -s 2 -f png`;
  execSync(cmd, { stdio: "pipe", timeout: 180_000 });
}

/**
 * AI-upscales an image, copies alpha from the original, resizes to target sizes.
 * Uses raw pixel buffers to avoid sharp composite dimension issues.
 */
async function upscaleAndResize(originalPath, outputEntries) {
  ensureDir(TEMP_DIR);
  const tempUpscaled = path.join(TEMP_DIR, `_up_${path.basename(originalPath)}`);

  try {
    // 1) AI upscale
    await upscaleWithRealESRGAN(originalPath, tempUpscaled);

    const upMeta = await sharp(tempUpscaled).metadata();

    // 2) Read both as raw RGBA
    const origRaw = await sharp(originalPath)
      .ensureAlpha()
      .resize(upMeta.width, upMeta.height, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const upRaw = await sharp(tempUpscaled)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 3) Copy alpha channel from original to upscaled
    const ch = upRaw.info.channels;
    const pixels = upRaw.info.width * upRaw.info.height;
    for (let i = 0; i < pixels; i++) {
      upRaw.data[i * ch + 3] = origRaw.data[i * 4 + 3];
    }

    // 4) Resize to each target size and write
    for (const { size, outPath } of outputEntries) {
      ensureDir(path.dirname(outPath));
      const buf = await sharp(upRaw.data, {
        raw: { width: upRaw.info.width, height: upRaw.info.height, channels: ch },
      })
        .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      fs.writeFileSync(outPath, buf);
    }

    fs.unlinkSync(tempUpscaled);
    return true;
  } catch (err) {
    if (fs.existsSync(tempUpscaled)) fs.unlinkSync(tempUpscaled);
    throw err;
  }
}

async function processFootballLogo(leagueFolder, logoFile) {
  const originalPath = path.join(LOGOS_DIR, leagueFolder, "700x700", logoFile);

  // Skip if all target sizes already exist
  if (skipExisting) {
    const allExist = OUTPUT_SIZES.every((size) =>
      fs.existsSync(path.join(LOGOS_DIR, leagueFolder, `${size}x${size}`, logoFile))
    );
    if (allExist) return "skipped";
  }

  const outputEntries = OUTPUT_SIZES.map((size) => ({
    size,
    outPath: path.join(LOGOS_DIR, leagueFolder, `${size}x${size}`, logoFile),
  }));

  await upscaleAndResize(originalPath, outputEntries);
}

async function processEfaLogos() {
  log("--- EFA Brand Logos ---");

  // Only upscale the main brand logo — icons are fine at native sizes for favicon/PWA
  const file = "efa-logo-white.png";
  const originalPath = path.join(EFA_DIR, file);
  if (!fs.existsSync(originalPath)) {
    log(`  SKIP ${file} (not found)`);
    return;
  }

  const meta = await sharp(originalPath).metadata();
  const targetW = meta.width * 2;
  const targetH = meta.height * 2;

  // Skip if already upscaled (width > 1000 means we ran before)
  if (meta.width > 1000) {
    log(`  SKIP ${file} (already ${meta.width}x${meta.height})`);
    return;
  }

  try {
    log(`  Upscaling ${file} (${meta.width}x${meta.height} -> ${targetW}x${targetH})`);
    await upscaleAndResize(originalPath, [{ size: targetW, outPath: originalPath }]);
    log(`  OK  ${file}`);
  } catch (err) {
    log(`  ERROR ${file}: ${err.message.split("\n")[0]}`);
  }
}

async function main() {
  log("=== Logo Upscaler (Real-ESRGAN 2x) ===");
  log(`Output sizes: ${OUTPUT_SIZES.map((s) => `${s}x${s}`).join(", ")}`);
  log("");

  if (!efaOnly) {
    await processEfaLogos();
    log("");
  }

  let leagues = getLeagueFolders();
  if (leagueArg) {
    leagues = leagues.filter((l) => l.toLowerCase().includes(leagueArg.toLowerCase()));
    if (leagues.length === 0) {
      log(`No league matching "${leagueArg}" found.`);
      return;
    }
  }
  if (testMode) leagues = leagues.slice(0, 1);

  log(`Processing ${leagues.length} league(s)...`);
  log("");

  let totalProcessed = 0;
  let totalFailed = 0;

  for (const league of leagues) {
    const logos = getTeamLogos(league);
    log(`--- ${league} (${logos.length} logos) ---`);

    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      process.stdout.write(`  [${i + 1}/${logos.length}] ${logo} ... `);
      try {
        const result = await processFootballLogo(league, logo);
        if (result === "skipped") {
          console.log("SKIP (exists)");
        } else {
          console.log("OK");
        }
        totalProcessed++;
      } catch (err) {
        console.log(`FAIL (${err.message.split("\n")[0]})`);
        totalFailed++;
      }
    }
    log("");
  }

  log("=== Done ===");
  log(`Processed: ${totalProcessed}, Failed: ${totalFailed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
