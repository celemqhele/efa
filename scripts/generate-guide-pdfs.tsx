import { renderToFile } from '@react-pdf/renderer'
import path from 'path'

import settingsDoc from './guide/settings'
import deadlinesDoc from './guide/deadlines'
import websiteDoc from './guide/website'
import aiDoc from './guide/ai'

interface GuideTarget {
  doc: React.ReactElement
  file: string
  name: string
}

const targets: GuideTarget[] = [
  { doc: settingsDoc, file: 'EFA-Guide-GameSettings.pdf', name: 'Game Settings' },
  { doc: deadlinesDoc, file: 'EFA-Guide-Deadlines.pdf', name: 'Deadlines' },
  { doc: websiteDoc, file: 'EFA-Guide-Website.pdf', name: 'Website' },
  { doc: aiDoc, file: 'EFA-Guide-AI.pdf', name: 'AI' },
]

async function main() {
  const outDir = path.join(process.cwd(), 'public')
  for (const target of targets) {
    const out = path.join(outDir, target.file)
    await renderToFile(target.doc, out)
    console.log(`[${target.name}] PDF written to public/${target.file}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})