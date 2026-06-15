'use client'
import { ViewportSwitch } from '@/components/ui/ViewportSwitch'
import Mobile from './_mobile'
import Desktop from './_desktop'

export default function Shell({ data }: { data: any }) {
  return (
    <ViewportSwitch
      mobile={<Mobile data={data} />}
      desktop={<Desktop data={data} />}
    />
  )
}
