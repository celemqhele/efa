'use client'

import SelectTeamClient from './SelectTeamClient'

export default function Mobile({ data }: { data: any }) {
  return <SelectTeamClient clubs={data.clubs} />
}
