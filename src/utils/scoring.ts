export type ScoreCategory =
  | 'EXATO'
  | 'VENCEDOR_GOLS'
  | 'EMPATE'
  | 'VENCEDOR_SALDO'
  | 'VENCEDOR_GOLS_PERDEDOR'
  | 'VENCEDOR'
  | 'GOLS_PARCIAL'
  | 'ERROU'

export type ScoringRules = Record<ScoreCategory, number>

export const DEFAULT_SCORING_RULES: ScoringRules = {
  EXATO:                  25,
  VENCEDOR_GOLS:          18,
  VENCEDOR_SALDO:         15,
  EMPATE:                 15,
  VENCEDOR_GOLS_PERDEDOR: 12,
  VENCEDOR:                6,
  GOLS_PARCIAL:            3,
  ERROU:                   0,
}

export const SCORING_LABELS: Record<ScoreCategory, { label: string; desc: string; color: string }> = {
  EXATO:                  { label: 'Placar Exato',               color: '#00d68f', desc: 'Cravou o placar. Ex: palpitou 2x1 e deu 2x1.' },
  VENCEDOR_GOLS:          { label: 'Vencedor e Gols',            color: '#00c2ff', desc: 'Acertou o vencedor e os gols de um time. Ex: palpitou 2x1 e deu 2x0.' },
  VENCEDOR_SALDO:         { label: 'Vencedor e Saldo de Gols',   color: '#5865F2', desc: 'Acertou o vencedor e a diferença de gols. Ex: palpitou 2x1 e deu 1x0.' },
  EMPATE:                 { label: 'Empate',                     color: '#a13de3', desc: 'Acertou que ia empatar (placar diferente). Ex: palpitou 2x2 e deu 1x1.' },
  VENCEDOR_GOLS_PERDEDOR: { label: 'Vencedor e Gols do Perdedor',color: '#ffb547', desc: 'Acertou o vencedor e os gols do time perdedor. Ex: palpitou 2x0 e deu 3x0.' },
  VENCEDOR:               { label: 'Vencedor',                   color: '#ff8c42', desc: 'Acertou apenas quem venceu o jogo. Ex: palpitou 2x0 e deu 3x2.' },
  GOLS_PARCIAL:           { label: 'Gols Parciais',              color: '#8b94a8', desc: 'Acertou os gols de um time mas errou o vencedor.' },
  ERROU:                  { label: 'Nenhum Acerto',              color: '#ff3d57', desc: 'Não acertou nada.' },
}

export interface DetailedScore {
  points: number
  category: ScoreCategory
}

export function calculateScoreDetailed(
  guessHome: number,
  guessAway: number,
  realHome: number,
  realAway: number,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): DetailedScore {
  if (guessHome === realHome && guessAway === realAway)
    return { points: rules.EXATO, category: 'EXATO' }

  const guessDiff = guessHome - guessAway
  const realDiff  = realHome  - realAway

  const guessWinner = guessDiff > 0 ? 'home' : guessDiff < 0 ? 'away' : 'draw'
  const realWinner  = realDiff  > 0 ? 'home' : realDiff  < 0 ? 'away' : 'draw'

  if (guessWinner === realWinner) {
    if (guessWinner === 'draw') return { points: rules.EMPATE, category: 'EMPATE' }

    const hitWinnerGoals =
      (realWinner === 'home' && guessHome === realHome) ||
      (realWinner === 'away' && guessAway === realAway)
    if (hitWinnerGoals) return { points: rules.VENCEDOR_GOLS, category: 'VENCEDOR_GOLS' }

    if (guessDiff === realDiff) return { points: rules.VENCEDOR_SALDO, category: 'VENCEDOR_SALDO' }

    const hitLoserGoals =
      (realWinner === 'home' && guessAway === realAway) ||
      (realWinner === 'away' && guessHome === realHome)
    if (hitLoserGoals) return { points: rules.VENCEDOR_GOLS_PERDEDOR, category: 'VENCEDOR_GOLS_PERDEDOR' }

    return { points: rules.VENCEDOR, category: 'VENCEDOR' }
  }

  if (guessHome === realHome || guessAway === realAway)
    return { points: rules.GOLS_PARCIAL, category: 'GOLS_PARCIAL' }

  return { points: rules.ERROU, category: 'ERROU' }
}

export function calculateScore(
  guessHome: number,
  guessAway: number,
  realHome: number,
  realAway: number,
  rules: ScoringRules = DEFAULT_SCORING_RULES
): number {
  return calculateScoreDetailed(guessHome, guessAway, realHome, realAway, rules).points
}
