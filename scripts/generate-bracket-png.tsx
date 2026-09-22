import { renderToFile } from '@react-pdf/renderer'
import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import sharp from 'sharp'
import bracketDoc, { ALL_TEAM_SLUGS, LOGO_CACHE_DIR } from './guide/knockout-bracket'

const LEAGUE = 'fifa-world-cup-2026.football-logos.cc'
const LOGO_PX = 208 // exact rendered size of the 52pt logo box at RENDER_DPI (52/72*288)

async function preResizeLogos() {
  fs.mkdirSync(LOGO_CACHE_DIR, { recursive: true })
  for (const slug of ALL_TEAM_SLUGS) {
    const out = path.join(LOGO_CACHE_DIR, `${slug}.png`)
    const src = path.join(process.cwd(), 'public', 'logos', LEAGUE, '1280x1280', `${slug}-national-team.png`)
    await sharp(src)
      .resize(LOGO_PX, LOGO_PX, { fit: 'contain', background: { r: 17, g: 26, b: 51, alpha: 1 } })
      .flatten({ background: '#111a33' })
      .png()
      .toFile(out)
  }
}

const GSWIN = 'C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe'
const PAGE_W = 1280 // pt
const PAGE_H = 720 // pt
const FINAL_W = 2560 // px (2K)
const FINAL_H = 1440
const RENDER_DPI = 288 // 2x the final 144dpi, sharp downsamples to final

async function main() {
  await preResizeLogos()
  const tmpDir = path.join(process.cwd(), 'node_modules', '.cache', 'bracket')
  fs.mkdirSync(tmpDir, { recursive: true })
  const pdfPath = path.join(tmpDir, 'knockout-bracket.pdf')
  const hiPng = path.join(tmpDir, 'hi.png')
  const outPng = path.join(process.cwd(), 'public', 'EFA-InternationalCup-KnockoutBracket.png')

  await renderToFile(bracketDoc, pdfPath)

  execSync(
    `"${GSWIN}" -dNOPAUSE -dBATCH -dSAFER ` +
      `-r${RENDER_DPI} -dTextAlphaBits=4 -dGraphicsAlphaBits=4 ` +
      `-sDEVICE=png16m -sOutputFile="${hiPng}" ` +
      `-g${Math.round((PAGE_W * RENDER_DPI) / 72)}x${Math.round((PAGE_H * RENDER_DPI) / 72)} "${pdfPath}"`,
    { stdio: 'inherit' }
  )

  await sharp(hiPng)
    .resize(FINAL_W, FINAL_H, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .png()
    .toFile(outPng)

  console.log(`[Knockout Bracket] PNG written to public/EFA-InternationalCup-KnockoutBracket.png (${FINAL_W}x${FINAL_H})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})