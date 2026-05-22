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
  const needsDarkCircle = teamSlug === 'tottenham'

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${needsDarkCircle ? 'dark:bg-white dark:rounded-full dark:p-0.5' : ''} ${className}`}
      onError={(e) => {
        const target = e.target as HTMLImageElement
        target.style.display = 'none'
      }}
    />
  )
}
