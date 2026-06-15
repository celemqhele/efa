'use client'

import { ViewportSwitch } from '@/components/ui/ViewportSwitch'
import Mobile from './_mobile'
import Desktop from './_desktop'

export default function Shell() {
  return (
    <ViewportSwitch
      mobile={<Mobile />}
      desktop={<Desktop />}
    />
  )
}
