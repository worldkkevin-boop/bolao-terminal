'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
  // Verifica ownership com client autenticado (respeita RLS de leitura)
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

  // Usa service role para bypassar RLS nas deleções
  const admin = createAdminClient()

  const { data: bonusQuestions } = await admin
    .from('bonus_questions')
    .select('id')
    .eq('group_id', groupId)

  if (bonusQuestions && bonusQuestions.length > 0) {
    const { error: baErr } = await admin
      .from('bonus_answers')
      .delete()
      .in('question_id', bonusQuestions.map((q: { id: string }) => q.id))
    if (baErr) { console.error('[deleteGroup] bonus_answers:', baErr); return { error: 'Erro ao excluir grupo' } }
  }

  const steps: Array<{ table: string; filter: { col: string; val: string } }> = [
    { table: 'bonus_questions', filter: { col: 'group_id', val: groupId } },
    { table: 'guesses',         filter: { col: 'group_id', val: groupId } },
    { table: 'group_members',   filter: { col: 'group_id', val: groupId } },
  ]

  for (const step of steps) {
    const { error } = await admin.from(step.table).delete().eq(step.filter.col, step.filter.val)
    if (error) { console.error(`[deleteGroup] ${step.table}:`, error); return { error: 'Erro ao excluir grupo' } }
  }

  const { error: groupErr } = await admin.from('groups').delete().eq('id', groupId)
  if (groupErr) { console.error('[deleteGroup] groups:', groupErr); return { error: 'Erro ao excluir grupo' } }

  redirect('/')
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
