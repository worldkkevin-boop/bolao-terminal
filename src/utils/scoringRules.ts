import { DEFAULT_SCORING_RULES, ScoringRules, ScoreCategory } from './scoring'

export function parseGroupScoringRules(scoringConfig: Record<string, number> | null | undefined): ScoringRules {
  if (!scoringConfig || Object.keys(scoringConfig).length === 0) return DEFAULT_SCORING_RULES

  const rules = { ...DEFAULT_SCORING_RULES }
  for (const [key, value] of Object.entries(scoringConfig)) {
    if (key in rules && typeof value === 'number') {
      rules[key as ScoreCategory] = value
    }
  }
  return rules
}
