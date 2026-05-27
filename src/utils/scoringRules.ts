import { createClient } from '@/utils/supabase/server'
import { DEFAULT_SCORING_RULES, ScoringRules, ScoreCategory } from './scoring'

export async function fetchScoringRules(): Promise<ScoringRules> {
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('scoring_rules').select('category, points')
    if (!data || data.length === 0) return DEFAULT_SCORING_RULES

    const rules = { ...DEFAULT_SCORING_RULES }
    for (const row of data) {
      if (row.category in rules) {
        rules[row.category as ScoreCategory] = row.points
      }
    }
    return rules
  } catch {
    return DEFAULT_SCORING_RULES
  }
}
