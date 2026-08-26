'use client'

import { ViewportSwitch } from '@/components/ui/ViewportSwitch'
import Mobile from './_mobile'
import Desktop from './_desktop'
import type { Team } from './_desktop'

interface Props {
  teams: Team[]
}

export default function Shell({ teams }: Props) {
  return (
    <ViewportSwitch
      mobile={<Mobile teams={teams} />}
      desktop={<Desktop teams={teams} />}
    />
  )
}
