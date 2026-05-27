import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { getFlagEmoji } from '@/utils/flags'
import { calculateScoreDetailed } from '@/utils/scoring'

export default async function MatchGuessesPage({ 
  params
}: { 
  params: Promise<{ id: string, matchId: string }>
}) {
  const { id, matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Puxa os dados do Grupo e Membros
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, profiles(full_name, avatar_url))')
    .eq('id', id)
    .single()

  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return <div className="p-10 text-white font-mono">Você não tem acesso a este grupo.</div>
  }

  // 2. Puxa os dados do Jogo
  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (!match) {
    return <div className="p-10 text-white font-mono">Partida não encontrada.</div>
  }

  const hasStarted = match.status !== 'UPC' && new Date(match.kickoff) < new Date()

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6 flex flex-col items-center justify-center">
        <Link href={`/groups/${group.id}?tab=matches`} className="text-xs text-[#00c2ff] hover:text-white mb-6">
          ← VOLTAR PARA O BOLÃO
        </Link>
        <div className="bg-[#12151b] border border-[#2a3140] p-8 rounded-2xl flex flex-col items-center text-center shadow-sm max-w-md">
          <span className="text-4xl mb-4">⏳</span>
          <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-wider">Aguarde o apito inicial</h2>
          <p className="text-sm text-[#5d6678]">
            Os palpites dos outros participantes só ficarão disponíveis após o início da partida.
          </p>
        </div>
      </div>
    )
  }

  // 3. Puxa os palpites desse jogo
  const { data: guesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('match_id', matchId)
    .eq('group_id', group.id)

  const guessesMap = new Map(guesses?.map(g => [g.user_id, g]) || [])

  // 4. Monta a lista e calcula pontos
  let exactMatchesCount = 0

  const guessesList = group.group_members.map((member: any) => {
    const guess = guessesMap.get(member.user_id)
    let points = 0
    let isExact = false

    if (guess && match.score_home !== null && match.score_away !== null) {
      const details = calculateScoreDetailed(guess.score_home, guess.score_away, match.score_home, match.score_away)
      points = details.points
      if (details.category === 'EXATO') {
        isExact = true
        exactMatchesCount++
      }
    } else if (guess && match.status === 'LIVE') {
      // Se tiver ao vivo, mostrar os pontos provisórios (mas não cravar)
      points = guess.points || 0
    } else if (guess && match.status === 'FIN') {
      points = guess.points || 0
      // Check for exact match from db points just in case calculateScoreDetailed wasn't possible
      if (points === 30) {
         isExact = true
         exactMatchesCount++
      }
    }

    return {
      userId: member.user_id,
      name: member.profiles.full_name || 'Sem Nome',
      avatarUrl: member.profiles.avatar_url || null,
      guess,
      points,
      isExact
    }
  })

  // Ordena por maior pontuação
  guessesList.sort((a: any, b: any) => {
    if (a.points !== b.points) return b.points - a.points
    // Se ambos não tiverem palpites, manter ordem alfabética
    if (!a.guess && !b.guess) return a.name.localeCompare(b.name)
    if (!a.guess) return 1
    if (!b.guess) return -1
    return 0
  })

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6">
      <Link href={`/groups/${group.id}?tab=matches`} className="text-xs text-[#5d6678] hover:text-white mb-6 inline-block">
        ← VOLTAR PARA O BOLÃO
      </Link>
      
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header do Jogo */}
        <div className="bg-[#12151b] border border-[#2a3140] p-6 md:p-8 rounded-2xl flex flex-col items-center shadow-sm">
          <div className="text-[10px] tracking-widest text-[#5d6678] uppercase w-full text-center mb-6">
            {new Date(match.kickoff).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • {match.status === 'LIVE' ? <span className="text-[#ff3d57] font-bold animate-pulse">AO VIVO</span> : match.status}
          </div>

          <div className="flex items-center justify-between w-full px-2 md:px-12">
            <div className="flex flex-col items-center flex-1">
              <span className="text-4xl md:text-5xl mb-3 drop-shadow-lg">{getFlagEmoji(match.home_team)}</span>
              <span className="text-sm md:text-base font-bold truncate text-center w-full">{match.home_team}</span>
            </div>
            
            <div className="flex flex-col items-center justify-center px-6">
              <span className="text-[#5d6678] text-[10px] uppercase tracking-widest mb-2">Placar Oficial</span>
              <div className="bg-[#1f242e] px-4 py-2 rounded font-bold text-[#00d68f] text-2xl md:text-3xl border border-[#00d68f]/30 shadow-[0_0_15px_rgba(0,214,143,0.1)]">
                {match.score_home ?? '-'} <span className="text-[#5d6678] text-xl mx-1">x</span> {match.score_away ?? '-'}
              </div>
            </div>
            
            <div className="flex flex-col items-center flex-1">
              <span className="text-4xl md:text-5xl mb-3 drop-shadow-lg">{getFlagEmoji(match.away_team)}</span>
              <span className="text-sm md:text-base font-bold truncate text-center w-full">{match.away_team}</span>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="bg-[#12151b] border border-[#2a3140] rounded-xl p-4 flex items-center justify-center">
          <p className="text-xs text-[#8b94a8]">
            <strong className="text-[#00c2ff]">{exactMatchesCount}</strong> de {group.group_members.length} membros cravaram o placar exato
          </p>
        </div>

        {/* Lista de Palpites */}
        <div className="space-y-3">
          {guessesList.map((entry: any, idx: number) => {
            const isMe = entry.userId === user.id
            const isExact = entry.isExact
            const hasGuess = !!entry.guess
            const initial = entry.name.charAt(0).toUpperCase()

            return (
              <div
                key={entry.userId}
                className="flex justify-between items-center bg-[#12151b] rounded-xl p-4 shadow-sm"
                style={{ 
                  border: isExact ? '1px solid #FFD700' : '1px solid #2a3140',
                  boxShadow: isExact ? '0 0 10px rgba(255, 215, 0, 0.1)' : 'none'
                }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Avatar */}
                  {entry.avatarUrl ? (
                    <Image
                      src={entry.avatarUrl}
                      alt={entry.name}
                      width={44}
                      height={44}
                      className="rounded-full object-cover shrink-0"
                      style={{ border: isExact ? '2px solid #FFD700' : '2px solid #2a3140' }}
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                      style={{ 
                        background: isExact ? '#FFD700' : '#5d6678', 
                        border: isExact ? '2px solid #FFD700' : '2px solid #2a3140' 
                      }}
                    >
                      {initial}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm truncate ${isMe ? 'text-[#00c2ff]' : 'text-[#e6eaf2]'}`}>
                        {entry.name}
                      </span>
                      {isMe && (
                        <span className="text-[9px] font-bold tracking-widest bg-[#00c2ff]/20 text-[#00c2ff] px-2 py-0.5 rounded-full shrink-0">
                          VOCÊ
                        </span>
                      )}
                    </div>
                    {hasGuess ? (
                      <span className="text-xs font-bold text-white mt-0.5">
                        Palpite: {entry.guess.score_home} x {entry.guess.score_away}
                      </span>
                    ) : (
                      <span className="text-xs text-[#5d6678] mt-0.5 italic">Sem palpite</span>
                    )}
                  </div>
                </div>

                {/* Pontos */}
                {hasGuess && (
                  <div className="flex flex-col items-end">
                    <span className={`font-bold text-lg whitespace-nowrap ${entry.points > 0 ? (isExact ? 'text-[#FFD700]' : 'text-[#00d68f]') : 'text-[#5d6678]'}`}>
                      +{entry.points} <span className="text-xs opacity-70">pts</span>
                    </span>
                    {isExact && (
                      <span className="text-[9px] text-[#FFD700] uppercase tracking-wider font-bold">Cravou!</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
