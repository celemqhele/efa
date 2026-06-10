'use client'

import Image from 'next/image'
import { getTeamLogo, type LogoContext } from '@/lib/logo-resolver'

interface TeamLogoProps {
  leagueFolder: string
  teamSlug: string
  context: LogoContext
  alt: string
  className?: string
}

const SIZE_PX: Record<LogoContext, number> = {
  standings_row: 64,
  group_table: 64,
  fixture_card: 128,
  profile_avatar: 128,
  news_thumb: 256,
  match_detail_hero: 512,
  broadcast_download: 700,
}

export default function TeamLogo({ leagueFolder, teamSlug, context, alt, className = '' }: TeamLogoProps) {
  const src = getTeamLogo(leagueFolder, teamSlug, context)
  const size = SIZE_PX[context]

  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="object-contain w-full h-full [filter:drop-shadow(0_0_2px_rgba(255,255,255,0.7))]"
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.parentElement!.style.display = 'none'
        }}
      />
    </div>
  )
}
