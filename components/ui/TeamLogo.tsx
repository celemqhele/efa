'use client'

import Image from 'next/image'
import { ShieldQuestion, Club } from 'lucide-react'
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

const PLACEHOLDER_FOLDER = 'custom'

// Placeholder clubs (e.g. the UEL "No Name" replacement) render a lucide icon
// instead of a logo image.
function getPlaceholderIcon(leagueFolder: string, teamSlug: string) {
  if (leagueFolder !== PLACEHOLDER_FOLDER) return null
  if (teamSlug === 'noname') return ShieldQuestion
  return null
}

export function TBCBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center justify-center gap-1 ${className}`}>
      <Club className="w-full h-full text-text-muted" strokeWidth={1.5} aria-label="TBC" />
    </div>
  )
}

export default function TeamLogo({ leagueFolder, teamSlug, context, alt, className = '' }: TeamLogoProps) {
  const PlaceholderIcon = getPlaceholderIcon(leagueFolder, teamSlug)

  if (PlaceholderIcon) {
    return (
      <div className={`inline-flex items-center justify-center overflow-hidden ${className}`}>
        <PlaceholderIcon className="w-full h-full text-text-muted" strokeWidth={1.5} aria-label={alt} />
      </div>
    )
  }

  const src = getTeamLogo(leagueFolder, teamSlug, context)
  const size = SIZE_PX[context]

  return (
    <div className={`inline-flex items-center justify-center overflow-hidden ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="object-contain w-full h-full"
        onError={(e) => {
          const target = e.target as HTMLImageElement
          target.parentElement!.style.display = 'none'
        }}
      />
    </div>
  )
}
