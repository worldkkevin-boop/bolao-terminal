'use client'

import { useState, useEffect } from 'react'

function formatCountdown(diffMs: number): { label: string; urgent: boolean } {
  if (diffMs <= 0) return { label: 'Começou', urgent: false }

  const totalSec = Math.floor(diffMs / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  if (days >= 1) {
    return { label: `em ${days}d ${hours}h`, urgent: false }
  }
  if (hours >= 1) {
    return { label: `em ${hours}h ${mins}min`, urgent: false }
  }
  return { label: `em ${mins}min ${secs}s`, urgent: true }
}

export function computeInitialLabel(kickoff: string): { label: string; urgent: boolean } {
  return formatCountdown(new Date(kickoff).getTime() - Date.now())
}

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
