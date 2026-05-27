'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { SCORING_LABELS, ScoreCategory } from '@/utils/scoring'

export async function updateScoringRules(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'worldkkevin@gmail.com') return { error: 'Não autorizado' }

  const admin = createAdminClient()
  const categories = Object.keys(SCORING_LABELS) as ScoreCategory[]

  for (const category of categories) {
    const raw = formData.get(category)
    const points = parseInt(raw as string)
    if (isNaN(points) || points < 0) continue
    await admin
      .from('scoring_rules')
      .upsert({ category, points }, { onConflict: 'category' })
  }

  redirect('/super-admin/scoring')
}
