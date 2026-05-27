export function formatCountdown(diffMs: number): { label: string; urgent: boolean } {
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
