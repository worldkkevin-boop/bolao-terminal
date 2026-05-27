'use client'

import { useState, useEffect } from 'react'

import { formatCountdown } from '@/utils/countdown'

export default function MatchCountdown({ kickoff, initialLabel, initialUrgent }: {
  kickoff: string
  initialLabel: string
  initialUrgent: boolean
}) {
  const [display, setDisplay] = useState({ label: initialLabel, urgent: initialUrgent })

  useEffect(() => {
    const tick = () => {
      const diff = new Date(kickoff).getTime() - Date.now()
      setDisplay(formatCountdown(diff))
    }

    tick()
    const id = setInterval(tick, display.urgent ? 1000 : 60_000)
    return () => clearInterval(id)
  }, [kickoff, display.urgent])

  return (
    <span className={`text-xs font-bold ${display.urgent ? 'text-[#ffb547] animate-pulse' : 'text-[#5d6678]'}`}>
      ⏱ {display.label}
    </span>
  )
}
