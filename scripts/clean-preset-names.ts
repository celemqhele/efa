import { readFile, writeFile } from 'fs/promises'

const content = await readFile('lib/all-presets.ts', 'utf-8')
// Extract the JSON array from the TS file
const jsonMatch = content.match(/export const ALL_PRESETS: ThemePreset\[\] = (\[[\s\S]*\])/)
if (!jsonMatch) { console.error('Could not parse presets'); process.exit(1) }

const presets = JSON.parse(jsonMatch[1])

// Manual name mapping based on original filenames
const nameMap: Record<string, [string, string]> = {
  arindamsahapwziswc2kls: ['Arindam Saha', 'Teal waters and lush greens'],
  columbinaanime26082: ['Columbina', 'Ethereal violet anime tones'],
  damianmarkuttea7qmegxqsm: ['Damian Markutt', 'Moody greys with warm undertones'],
  dianaparkhouse5ry9gtjpxzm: ['Diana Parkhouse', 'Deep amber and burnt orange'],
  dianaparkhouseqf4ezxc3t2y: ['Diana Parkhouse II', 'Dark oceanic blues'],
  dominikfischerf9uan6snts8: ['Dominik Fischer', 'Starry night with golden lights'],
  hannahmontez05kfkdsxdjk: ['Hannah Montez', 'Muted olives and natural beiges'],
  hannahmontez2vslrz5g8fo: ['Hannah Montez II', 'Earthy browns and warm sands'],
  ishanseefromtheskybmjwpck6eqa: ['Ishan Seefromthesky', 'Vibrant tropical teals'],
  itachiuchiha26522: ['Itachi Uchiha', 'Dark crimson with ethereal pink'],
  jeremybishop4kv4odtkd0u: ['Jeremy Bishop', 'Deep midnight blues'],
  joelvodelltapakerw5pq: ['Joel Vodell', 'Rich teal and sea foam'],
  jooheonsuhtomb26624: ['Jooheon Suh', 'Ancient stone and gold'],
  kawaiicatgirl26545: ['Kawaii Cat Girl', 'Monochrome with soft greys'],
  kusuriyano26623: ['Kusuriya no Hitorigoto', 'Warm peaches and navy'],
  nathandumlaoswih3kr1u: ['Nathan Dumlao', 'Warm coffee and amber'],
  pexelsadrienolichon12570892387819: ['Adrien Olichon', 'Charcoal and smoke'],
  pexelsfriededia30649280: ['Friede Dia', 'Warm browns and vintage blues'],
  pexelsjplenio1642770: ['Johannes Plenio', 'Mystic forest purples'],
  pexelsjplenio2080960: ['Johannes Plenio II', 'Golden hour in blue'],
  pexelslichtblick80030299053: ['Lichtblick', 'Misty fog and muted tones'],
  pexelssteve29579756: ['Steve', 'Dark romance with rose'],
  robertvruggierozmismijwhvo: ['Robert Ruggiero', 'Olive greens and slate'],
  taragannaraka26383: ['Tara Gan', 'Stone and shadow'],
  thevillagerof26621: ['The Villager', 'Crimson skies and pale blue'],
  willturnerkpcxubuceps: ['Will Turner', 'Coastal mist and steel'],
  wolfganghasselmannwqdcqltfui8: ['Wolfgang Hasselmann', 'Autumn earth and bark'],
  zenitsuagatsuma26520: ['Zenitsu Agatsuma', 'Thunder gold and charcoal'],
  zhuangfangyi5k26452: ['Zhuang Fangyi', 'Shades of white and stone'],
}

for (const p of presets) {
  const mapped = nameMap[p.id]
  if (mapped) {
    p.name = mapped[0]
    p.description = mapped[1]
  } else {
    // fallback: clean up the ID
    p.name = p.id.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

// Generate themes.ts content
let output = `// Theme presets — all 29 from THEME PICTURES folder
// Auto-generated from lib/all-presets.ts with cleaned names

import type { ThemePreset } from './themes'

export const ALL_PRESETS: ThemePreset[] = ${JSON.stringify(presets, null, 2)}
`

await writeFile('lib/all-presets.ts', output)
console.log(`Cleaned ${presets.length} preset names`)
