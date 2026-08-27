'use client'

import { ViewportSwitch } from '@/components/ui/ViewportSwitch'
import Mobile from './_mobile'
import Desktop from './_desktop'
import type { League } from './_desktop'

interface Props {
  leagues: League[]
}

export default function Shell({ leagues }: Props) {
  return (
    <ViewportSwitch
      mobile={<Mobile leagues={leagues} />}
      desktop={<Desktop leagues={leagues} />}
    />
  )
}
