import { getCountryCode } from '@/utils/teamFlags'

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, string> = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
}

const fallbackTextSize: Record<Size, string> = {
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

export default function TeamFlag({ team, size = 'md' }: { team: string; size?: Size }) {
  const code = getCountryCode(team)
  const sizeClass = sizeClasses[size]

  if (code) {
    return (
      <span
        className={`fi fi-${code} fis rounded-full ${sizeClass}`}
        title={team}
        aria-label={team}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} ${fallbackTextSize[size]} rounded-full bg-[#2a3140] text-white flex items-center justify-center font-bold shrink-0`}
      title={team}
      aria-label={team}
    >
      {team.slice(0, 2).toUpperCase()}
    </div>
  )
}
