export const dynamic = 'force-dynamic'

import { buildRegistry } from './registry'
import SelectTeamClient from './SelectTeamClient'

export default async function SelectTeamPage() {
  const registry = await buildRegistry()
  return <SelectTeamClient registry={registry} />
}
