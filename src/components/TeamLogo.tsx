'use client'

import { useState } from 'react'
import Image from 'next/image'

type Props = {
  teamId?: number
  teamName: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const SIZE_PX: Record<NonNullable<Props['size']>, number> = {
  sm: 24,
  md: 40,
  lg: 64,
  xl: 96,
}

export default function TeamLogo({ teamId, teamName, size = 'md' }: Props) {
  const [error, setError] = useState(false)
  const px = SIZE_PX[size]
  const initials = teamName.slice(0, 2).toUpperCase()

  if (!teamId || error) {
    return (
      <div
        className="rounded-full bg-[#2a3140] flex items-center justify-center font-bold text-[#8b94a8] shrink-0"
        style={{ width: px, height: px, fontSize: px * 0.35 }}
      >
        {initials}
      </div>
    )
  }

  return (
    <Image
      src={`https://media.api-sports.io/football/teams/${teamId}.png`}
      alt={teamName}
      width={px}
      height={px}
      unoptimized
      loading="lazy"
      className="rounded-full bg-white p-0.5 object-contain shrink-0"
      style={{ width: px, height: px }}
      onError={() => setError(true)}
    />
  )
}
