#!/usr/bin/env node
// Vendor the tesseract assets the deterministic verifier relies on.
// Keeps `assets/ocr/` reproducible from `node_modules` rather than relying
// on an untracked file copied by hand.
//
// Usage: node scripts/vendor-ocr-assets.mjs

import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve('node_modules', 'tesseract.js-core')
const dstDir = path.resolve('assets', 'ocr')

fs.mkdirSync(dstDir, { recursive: true })

const files = fs.readdirSync(srcDir)
  .filter((n) => n.endsWith('.traineddata') || (n.endsWith('.wasm.js') && n.includes('lstm')))

for (const f of files) {
  const from = path.join(srcDir, f)
  const to = path.join(dstDir, f)
  fs.copyFileSync(from, to)
  console.log('copied', f)
}
