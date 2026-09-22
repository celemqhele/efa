import { renderToFile } from '@react-pdf/renderer'
import path from 'path'
import placementDoc from './guide/placement-announcement'

async function main() {
  const outDir = path.join(process.cwd(), 'public')
  const out = path.join(outDir, 'EFA-Announcement-LeaguePlacement.pdf')
  await renderToFile(placementDoc, out)
  console.log(`[League Placement Announcement] PDF written to public/EFA-Announcement-LeaguePlacement.pdf`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})