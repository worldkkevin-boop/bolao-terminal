import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import TVRotator from './TVRotator'
import { calculateScore } from '@/utils/scoring'

export default async function TVModePage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Grupo e Membros
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, role, profiles(full_name, avatar_url))')
    .eq('id', id)
    .single()

  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return <div className="p-10 text-white font-mono bg-black min-h-screen">Acesso negado.</div>
  }

  // 2. Partidas
  const { data: allMatches } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff', { ascending: true })

  if (!allMatches) {
    return <div className="p-10 text-white font-mono bg-black min-h-screen">Erro ao carregar partidas.</div>
  }

  const upcomingMatches = allMatches.filter(m => m.status === 'UPC').slice(0, 3)
  // Partidas FIN mais recentes (ordem decrescente de kickoff)
  const finishedMatches = allMatches.filter(m => m.status === 'FIN').reverse().slice(0, 3)
  const allFinishedMatchesMap = new Map(allMatches.filter(m => m.status === 'FIN' || m.status === 'LIVE').map(m => [m.id, m]))

  // 3. Palpites e Leaderboard (Igual ao dashboard)
  const { data: allGuesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('group_id', group.id)

  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('group_id', group.id)
  
  const { data: bonusAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .in('question_id', bonusQuestions?.map(q => q.id) || [])

  const guessesByUser = new Map<string, NonNullable<typeof allGuesses>>()
  if (allGuesses) {
    for (const g of allGuesses) {
      const list = guessesByUser.get(g.user_id)
      if (list) list.push(g)
      else guessesByUser.set(g.user_id, [g])
    }
  }

  const bonusByUser = new Map<string, number>()
  if (bonusAnswers) {
    for (const b of bonusAnswers) {
      bonusByUser.set(b.user_id, (bonusByUser.get(b.user_id) || 0) + (b.points_earned || 0))
    }
  }

  const leaderboard = group.group_members.map((member: any) => {
    let matchPoints = 0
    let bonusPoints = bonusByUser.get(member.user_id) || 0
    
    const memberGuesses = guessesByUser.get(member.user_id) || []
    
    memberGuesses.forEach(guess => {
      const match = allFinishedMatchesMap.get(guess.match_id)
      if (match && match.score_home !== null && match.score_away !== null) {
        if (match.status === 'FIN') {
          matchPoints += guess.points ?? 0
        } else {
          matchPoints += calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away)
        }
      }
    })

    return {
      userId: member.user_id,
      name: member.profiles.full_name || 'Sem Nome',
      avatarUrl: member.profiles.avatar_url || null,
      points: matchPoints + bonusPoints
    }
  })

  // Ordena por maior pontuação e pega o TOP 10
  leaderboard.sort((a: any, b: any) => b.points - a.points)
  const top10Leaderboard = leaderboard.slice(0, 10)

  return (
    <TVRotator 
      group={group} 
      leaderboard={top10Leaderboard} 
      upcomingMatches={upcomingMatches} 
      recentMatches={finishedMatches} 
    />
  )
}
