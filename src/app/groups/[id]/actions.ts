'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { DEFAULT_SCORING_RULES, ScoreCategory } from '@/utils/scoring'

export async function saveGuess(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Não autorizado' }

  const matchId = formData.get('matchId') as string
  const scoreHome = parseInt(formData.get('scoreHome') as string)
  const scoreAway = parseInt(formData.get('scoreAway') as string)
  const groupId = formData.get('groupId') as string

  if (isNaN(scoreHome) || isNaN(scoreAway)) {
    return { error: 'Placar inválido' }
  }

  // Verificar se o jogo já começou
  const { data: match } = await supabase
    .from('matches')
    .select('kickoff, status')
    .eq('id', matchId)
    .single()

  if (!match) return { error: 'Jogo não encontrado' }

  if (match.status !== 'UPC' && new Date(match.kickoff) < new Date()) {
    return { error: 'O jogo já começou! Palpites encerrados.' }
  }

  const { error } = await supabase
    .from('guesses')
    .upsert(
      { 
        user_id: user.id, 
        match_id: matchId, 
        group_id: groupId, 
        score_home: scoreHome, 
        score_away: scoreAway 
      },
      { onConflict: 'user_id, match_id, group_id' }
    )

  if (error) {
    return { error: 'Falha ao salvar palpite' }
  }

  revalidatePath(`/groups/${groupId}`)
  return { success: true }
}

export async function deleteGroup(groupId: string) {
  // Verifica ownership com client autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('owner_id', user.id)
    .single()

  if (!group) return { error: 'Não autorizado' }

  // Service role bypassa RLS — ON DELETE CASCADE no banco cuida dos filhos
  const admin = createAdminClient()
  const { error } = await admin.from('groups').delete().eq('id', groupId)

  if (error) {
    console.error('[deleteGroup]', error)
    return { error: 'Erro ao excluir grupo' }
  }

  redirect('/')
}

export async function updateGroupScoringRules(groupId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('owner_id', user.id)
    .single()

  if (!group) return { error: 'Não autorizado' }

  const config: Record<string, number> = {}
  for (const category of Object.keys(DEFAULT_SCORING_RULES) as ScoreCategory[]) {
    const points = parseInt(formData.get(category) as string)
    if (!isNaN(points) && points >= 0) config[category] = points
  }

  const admin = createAdminClient()
  const { error } = await admin.from('groups').update({ scoring_config: config }).eq('id', groupId)

  if (error) { console.error('[updateGroupScoringRules]', error); return { error: 'Erro ao salvar' } }

  revalidatePath(`/groups/${groupId}`)
  redirect(`/groups/${groupId}?tab=settings`)
}

export async function leaveGroup(groupId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)

  if (error) return { error: 'Erro ao sair do grupo' }
  redirect('/')
}
