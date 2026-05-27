'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
