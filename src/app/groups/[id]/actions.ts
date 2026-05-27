'use server'

import { createClient } from '@/utils/supabase/server'
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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autorizado' }

  // Confirma que o user é owner antes de qualquer coisa
  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('owner_id', user.id)
    .single()

  if (!group) return { error: 'Não autorizado' }

  // Deleta registros filhos na ordem correta (FK constraints)
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('group_id', groupId)

  if (bonusQuestions && bonusQuestions.length > 0) {
    await supabase
      .from('bonus_answers')
      .delete()
      .in('question_id', bonusQuestions.map(q => q.id))
  }

  await supabase.from('bonus_questions').delete().eq('group_id', groupId)
  await supabase.from('guesses').delete().eq('group_id', groupId)
  await supabase.from('group_members').delete().eq('group_id', groupId)

  const { error } = await supabase.from('groups').delete().eq('id', groupId)

  if (error) return { error: 'Erro ao excluir grupo' }
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
