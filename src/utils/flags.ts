const flagsMap: Record<string, string> = {
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Italy': '🇮🇹',
  'Netherlands': '🇳🇱', 'Uruguay': '🇺🇾', 'Croatia': '🇭🇷', 'Belgium': '🇧🇪',
  'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Mexico': '🇲🇽',
  'USA': '🇺🇸', 'Canada': '🇨🇦', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Bosnia & Herzegovina': '🇧🇦'
}

export function getFlagEmoji(teamName: string) {
  return flagsMap[teamName] || '🛡️'
}
