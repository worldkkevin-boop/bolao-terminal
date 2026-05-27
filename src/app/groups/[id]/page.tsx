import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { saveGuess, leaveGroup, updateGroupScoringRules } from './actions'
import { calculateScore, calculateScoreDetailed, SCORING_LABELS, ScoreCategory } from '@/utils/scoring'
import { parseGroupScoringRules } from '@/utils/scoringRules'
import MatchCountdown from '@/components/MatchCountdown'
import { computeInitialLabel } from '@/utils/countdown'
import CopyInviteButton from '@/components/CopyInviteButton'
import TeamLogo from '@/components/TeamLogo'
import DeleteGroupButton from '@/components/DeleteGroupButton'

export default async function GroupDashboard({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const { tab, filter, rankingScope } = await searchParams
  const activeTab = typeof tab === 'string' ? tab : 'matches'
  const validFilters = ['upcoming', 'live', 'finished'] as const
  const activeFilter = typeof filter === 'string' && validFilters.includes(filter as any) ? filter as typeof validFilters[number] : 'upcoming'
  const validScopes = ['overall', 'round', 'month'] as const
  const activeScope = typeof rankingScope === 'string' && validScopes.includes(rankingScope as any) ? rankingScope as typeof validScopes[number] : 'overall'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Puxa os dados do Grupo
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, role, profiles(full_name, avatar_url))')
    .eq('id', id)
    .single()

  // 2. Verifica se o user logado é membro desse grupo
  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return <div className="p-10 text-white font-mono">Você não tem acesso a este grupo.</div>
  }

  const currentUserRole = group.group_members.find((m: any) => m.user_id === user.id)?.role

  // 3. Regras de pontuação do grupo (fallback nos defaults)
  const scoringRules = parseGroupScoringRules(group.scoring_config)

  // 4. Puxa os Jogos (filtrados por status) + counts em paralelo
  const statusMap = { upcoming: 'UPC', live: 'LIVE', finished: 'FIN' } as const
  const matchStatus = statusMap[activeFilter]
  const isFinished = activeFilter === 'finished'

  const [{ count: upcomingCount }, { count: liveCount }, { count: finishedCount }, { data: matches }] = await Promise.all([
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'UPC'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'LIVE'),
    supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'FIN'),
    supabase.from('matches').select('*').eq('status', matchStatus).order('kickoff', { ascending: !isFinished }).limit(30),
  ])

  // 4. Puxa TODOS os palpites deste grupo para calcular o ranking
  const { data: allGuesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('group_id', group.id)

  const userGuesses = allGuesses?.filter(g => g.user_id === user.id) || []
  const guessesMap = new Map(userGuesses.map(g => [g.match_id, g]))

  // 4.5 Puxa TODOS os pontos bônus deste grupo
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('group_id', group.id)
  
  const { data: bonusAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .in('question_id', bonusQuestions?.map(q => q.id) || [])

  // 5. Puxa TODOS os matches FIN/LIVE para cálculo de leaderboard (independente do filtro da aba partidas)
  const { data: allFinishedMatches } = await supabase
    .from('matches')
    .select('*')
    .or('status.eq.FIN,status.eq.LIVE')
    .order('kickoff', { ascending: false })

  // Lookup O(1) de matches por id para o leaderboard
  const allMatchesMap = new Map(allFinishedMatches?.map(m => [m.id, m]) || [])

  // Determinar escopo do ranking
  let scopedMatchIds: Set<any>
  let rankingSubtitle = 'Ranking Geral'

  if (activeScope === 'round') {
    // Pega a rodada do jogo FIN mais recente
    const latestFinished = allFinishedMatches?.find(m => m.status === 'FIN')
    const latestRound = latestFinished?.round || null
    if (latestRound) {
      scopedMatchIds = new Set(allFinishedMatches?.filter(m => m.round === latestRound)?.map(m => m.id) || [])
      rankingSubtitle = `Ranking: ${latestRound}`
    } else {
      scopedMatchIds = new Set()
      rankingSubtitle = 'Nenhuma rodada finalizada'
    }
  } else if (activeScope === 'month') {
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59))
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    scopedMatchIds = new Set(
      allFinishedMatches?.filter(m => {
        const k = new Date(m.kickoff)
        return k >= monthStart && k <= monthEnd
      })?.map(m => m.id) || []
    )
    rankingSubtitle = `Ranking de ${monthNames[now.getUTCMonth()]}/${now.getUTCFullYear()}`
  } else {
    scopedMatchIds = new Set(allFinishedMatches?.map(m => m.id) || [])
  }

  // Agrupa guesses por user_id uma vez só (evita .filter() repetido)
  const guessesByUser = new Map<string, NonNullable<typeof allGuesses>>()
  if (allGuesses) {
    for (const g of allGuesses) {
      const list = guessesByUser.get(g.user_id)
      if (list) {
        list.push(g)
      } else {
        guessesByUser.set(g.user_id, [g])
      }
    }
  }

  // Agrupa bônus por user_id
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
      // Só conta se o match está no escopo selecionado
      if (!scopedMatchIds.has(guess.match_id)) return
      const match = allMatchesMap.get(guess.match_id)
      
      if (match && match.score_home !== null && match.score_away !== null) {
        if (match.status === 'FIN') {
          matchPoints += guess.points ?? 0
        } else {
          matchPoints += calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away, scoringRules)
        }
      }
    })

    const totalPoints = matchPoints + bonusPoints

    return {
      userId: member.user_id,
      name: member.profiles.full_name || 'Sem Nome',
      avatarUrl: member.profiles.avatar_url || null,
      matchPoints,
      bonusPoints,
      points: totalPoints
    }
  })

  // Ordena por maior pontuação
  leaderboard.sort((a: any, b: any) => b.points - a.points)

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6">
      <div className="text-[11px] text-[#5d6678] mb-1">
        <Link href="/" className="hover:text-white transition">← VOLTAR AO INÍCIO</Link>
      </div>
      
      <header className="flex flex-col md:flex-row justify-between md:items-end border-b border-[#1f242e] pb-4 mb-6 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#00c2ff]">BOLÃO:</div>
          <h1 className="text-[28px] font-bold tracking-tight uppercase leading-none mt-1">{group.name}</h1>
          <div className="mt-3 flex gap-3">
            {currentUserRole === 'owner' ? (
              <DeleteGroupButton groupId={group.id} />
            ) : (
              <form action={leaveGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                <button type="submit" className="text-[10px] font-bold tracking-wider text-[#ffb547] border border-[#ffb547]/50 px-3 py-1.5 rounded hover:bg-[#ffb547] hover:text-black transition">
                  SAIR DO BOLÃO
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="bg-[#12151b] border border-[#2a3140] px-4 py-2 rounded-md flex items-center gap-3">
          <span className="text-[10px] tracking-[0.15em] text-[#5d6678] hidden sm:inline">CÓDIGO DE CONVITE:</span>
          <span className="font-bold text-[#ffb547] text-base">{group.invite_code}</span>
          <CopyInviteButton inviteCode={group.invite_code} />
        </div>
      </header>

      {/* Menu de Abas */}
      <div className="flex gap-6 border-b border-[#1f242e] mb-6 overflow-x-auto no-scrollbar">
        <Link 
          href={`/groups/${group.id}?tab=matches`} 
          className={`pb-2.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap ${activeTab === 'matches' ? 'text-[#00c2ff] border-b-2 border-[#00c2ff]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          PARTIDAS
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=ranking`} 
          className={`pb-2.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap ${activeTab === 'ranking' ? 'text-[#ffb547] border-b-2 border-[#ffb547]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          RANKING
        </Link>
        <Link 
          href={`/groups/${group.id}/bonus`} 
          className="pb-2.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap text-[#5d6678] hover:text-[#e6eaf2] transition"
        >
          BÔNUS
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=settings`} 
          className={`pb-2.5 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap ${activeTab === 'settings' ? 'text-[#00d68f] border-b-2 border-[#00d68f]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          CONFIGURAÇÕES
        </Link>
      </div>

      <div className="min-h-[50vh]">
        
        {/* ABA: PARTIDAS */}
        {activeTab === 'matches' && (() => {
          const totalMatches = (upcomingCount || 0) + (liveCount || 0) + (finishedCount || 0)
          const guessesCount = userGuesses.length
          const percent = totalMatches > 0 ? Math.round((guessesCount / totalMatches) * 100) : 0

          return (
            <section className="space-y-6 max-w-3xl mx-auto">
              {/* Sub-filtro: Futuras / Ao vivo / Encerradas */}
              <div className="flex gap-2 justify-center mb-5">
                {[
                  { key: 'upcoming',  label: 'Futuras',    count: upcomingCount ?? 0, color: '#00c2ff' },
                  { key: 'live',      label: 'Ao vivo',    count: liveCount ?? 0,     color: '#ff3d57' },
                  { key: 'finished',  label: 'Encerradas', count: finishedCount ?? 0, color: '#00d68f' },
                ].map(f => {
                  const isActive = activeFilter === f.key
                  const hasLive = f.key === 'live' && (liveCount ?? 0) > 0
                  return (
                    <Link
                      key={f.key}
                      href={`/groups/${group.id}?tab=matches&filter=${f.key}`}
                      className={`text-[11px] font-bold px-4 py-1.5 rounded-full border transition-all flex items-center gap-2 ${
                        isActive
                          ? 'text-black'
                          : 'text-[#8b94a8] border-[#2a3140] hover:border-[#5d6678] bg-[#12151b]'
                      }`}
                      style={isActive ? { background: f.color, borderColor: f.color } : {}}
                    >
                      {f.key === 'live' && hasLive && (
                        <span className={`w-1.5 h-1.5 rounded-full bg-[#ff3d57] ${isActive ? 'bg-black' : ''} animate-pulse`} />
                      )}
                      {f.label} ({f.count})
                    </Link>
                  )
                })}
              </div>

              {/* Progress Bar */}
              <div className="mb-6 max-w-2xl mx-auto">
                <div className="flex justify-between text-[11px] text-[#8b94a8] mb-1.5">
                  <span>Você palpitou em {guessesCount} de {totalMatches} jogos do torneio</span>
                  <span className="text-[#00c2ff] font-bold">{percent}%</span>
                </div>
                <div className="bg-[#12151b] h-1 rounded-full overflow-hidden">
                  <div className="bg-[#00c2ff] h-full transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                </div>
              </div>

              <div className="flex items-center gap-3 my-6 max-w-2xl mx-auto">
                <div className="text-[10px] font-bold tracking-[0.3em] text-[#00c2ff]">
                  {activeFilter === 'upcoming' ? 'PRA PALPITAR' : activeFilter === 'live' ? 'JOGOS AO VIVO' : 'RESULTADOS'}
                </div>
                <div className="flex-1 h-px bg-[#1f242e]"></div>
              </div>

              <div className="space-y-3 max-w-2xl mx-auto">
                {matches?.map(match => {
                  const guess = guessesMap.get(match.id)
                  const hasStarted = match.status !== 'UPC' && new Date(match.kickoff) < new Date()

                  let pointsEarned = null;
                  let scoreDetails = null;
                  if (hasStarted && guess && match.score_home !== null && match.score_away !== null) {
                    scoreDetails = calculateScoreDetailed(guess.score_home, guess.score_away, match.score_home, match.score_away, scoringRules);
                    pointsEarned = scoreDetails.points;
                  }

                  const { label, urgent } = computeInitialLabel(match.kickoff)

                  return (
                    <div key={match.id} className="bg-[#12151b] border border-[#2a3140] rounded-lg p-3.5 flex flex-col md:flex-row md:items-center gap-4 transition-all hover:border-[#5d6678]">
                      
                      {/* Escudos e Nomes (Esquerda) */}
                      <div className="flex items-center gap-2.5 flex-1">
                        <TeamLogo teamId={match.home_team_id} teamName={match.home_team} size="sm" />
                        <div className="text-[13px] font-bold truncate max-w-[100px]">{match.home_team}</div>
                        <div className="text-[10px] text-[#5d6678] mx-1">VS</div>
                        <div className="text-[13px] font-bold truncate max-w-[100px]">{match.away_team}</div>
                        <TeamLogo teamId={match.away_team_id} teamName={match.away_team} size="sm" />
                      </div>

                      {/* Info Central (Data / Countdown / Placares Reais) */}
                      <div className="flex flex-col items-center text-[10px] text-[#8b94a8] min-w-[90px]">
                        <div>{new Date(match.kickoff).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo' })}</div>
                        
                        {!hasStarted ? (
                          <div className={`mt-0.5 font-bold ${urgent ? 'text-[#ffb547]' : 'text-[#5d6678]'}`}>
                            ⏱ {label}
                          </div>
                        ) : match.status === 'LIVE' ? (
                          <div className="text-[#ff3d57] font-bold animate-pulse mt-0.5">AO VIVO</div>
                        ) : (
                          <div className="text-[#00d68f] font-bold mt-0.5">ENCERRADO</div>
                        )}

                        {hasStarted && (
                          <div className="bg-[#1f242e] px-2 py-0.5 rounded text-[#e6eaf2] font-bold text-xs mt-1 border border-[#2a3140]">
                            {match.score_home ?? 0} - {match.score_away ?? 0}
                          </div>
                        )}
                      </div>

                      {/* Inputs de Palpite (Direita) */}
                      <div className="flex items-center gap-1.5 justify-center md:justify-end border-t border-[#1f242e] md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                        <form action={saveGuess as unknown as (formData: FormData) => void} className="flex items-center gap-1.5">
                          <input type="hidden" name="matchId" value={match.id} />
                          <input type="hidden" name="groupId" value={group.id} />
                          
                          <input 
                            type="number" 
                            name="scoreHome" 
                            defaultValue={guess?.score_home ?? ''}
                            disabled={hasStarted}
                            className={`w-10 h-10 bg-[#08090b] border ${guess ? 'border-[#00c2ff]' : 'border-[#2a3140]'} rounded-md text-center text-white text-base font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-70`} 
                            placeholder="0"
                            required
                          />
                          <span className="text-[#5d6678] text-[11px]">×</span>
                          <input 
                            type="number" 
                            name="scoreAway" 
                            defaultValue={guess?.score_away ?? ''}
                            disabled={hasStarted}
                            className={`w-10 h-10 bg-[#08090b] border ${guess ? 'border-[#00c2ff]' : 'border-[#2a3140]'} rounded-md text-center text-white text-base font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-70`} 
                            placeholder="0"
                            required
                          />
                          
                          <button 
                            type="submit" 
                            disabled={hasStarted}
                            className={`text-[10px] font-bold tracking-[0.15em] ml-1.5 px-3 py-2.5 rounded-md transition disabled:opacity-30 disabled:bg-[#2a3140] disabled:text-[#5d6678] ${guess ? 'bg-transparent text-[#00c2ff] border border-[#00c2ff] hover:bg-[#00c2ff]/10' : 'bg-[#00c2ff] text-black border border-[#00c2ff] hover:bg-white hover:border-white'}`}
                          >
                            {guess ? 'ATUALIZAR' : 'SALVAR'}
                          </button>
                        </form>
                      </div>

                      {/* Pontos Ganhos Dropdown (Mobile-first friendly) */}
                      {hasStarted && guess && match.status === 'FIN' && scoreDetails && (
                        <div className="w-full flex justify-end text-xs">
                          <div className={`font-bold px-3 py-1 rounded-full bg-[#08090b] border ${scoreDetails.points > 0 ? (scoreDetails.category === 'EXATO' ? 'text-[#00d68f] border-[#00d68f]/30' : 'text-[#00c2ff] border-[#00c2ff]/30') : 'text-[#5d6678] border-[#2a3140]'}`}>
                            {scoreDetails.points > 0 ? `+${scoreDetails.points} pts` : '0 pts'}
                          </div>
                        </div>
                      )}

                      {/* Link ver palpites se o jogo começou */}
                      {hasStarted && (
                        <Link 
                          href={`/groups/${group.id}/matches/${match.id}`}
                          className="w-full text-center text-[10px] text-[#00c2ff] hover:underline uppercase tracking-widest mt-2"
                        >
                          Ver palpites do grupo
                        </Link>
                      )}
                    </div>
                  )
                })}
                
                {!matches || matches.length === 0 && (
                  <div className="text-center text-[#5d6678] py-10 border border-dashed border-[#2a3140] rounded-xl">
                    Nenhum jogo disponível nesta aba.
                  </div>
                )}
              </div>
            </section>
          )
        })()}

        {/* ABA: RANKING */}
        {activeTab === 'ranking' && (
          <section className="space-y-6 max-w-2xl mx-auto">

            {/* Sub-abas de escopo */}
            <div className="flex gap-2 justify-center mb-6">
              {[
                { key: 'overall', label: 'Geral', color: '#ffb547' },
                { key: 'round',   label: 'Rodada Atual', color: '#ffb547' },
                { key: 'month',   label: 'Este Mês', color: '#ffb547' },
              ].map(s => {
                const isActive = activeScope === s.key
                return (
                  <Link
                    key={s.key}
                    href={`/groups/${group.id}?tab=ranking&rankingScope=${s.key}`}
                    className={`text-[11px] font-bold px-4 py-1.5 rounded-full transition-all ${
                      isActive ? 'bg-[#ffb547] text-black' : 'bg-[#12151b] text-[#8b94a8] border border-[#2a3140] hover:border-[#5d6678]'
                    }`}
                  >
                    {s.label}
                  </Link>
                )
              })}
            </div>

            <div className="text-center text-[10px] text-[#8b94a8] tracking-[0.2em] mb-5 uppercase">
              PONTUAÇÃO ATUALIZADA EM TEMPO REAL
            </div>

            <div className="bg-transparent">
              {scopedMatchIds.size === 0 ? (
                <div className="text-center text-[#5d6678] py-10 border border-dashed border-[#2a3140] rounded-xl">
                  {activeScope === 'round' ? 'Nenhuma partida finalizada nesta rodada ainda' : 'Nenhuma partida finalizada neste mês ainda'}
                </div>
              ) : (
              
              <div className="flex flex-col">
                {leaderboard.map((entry: any, idx: number) => {
                  const isMe = entry.userId === user.id
                  const rank = idx + 1
                  const podiumConfig = rank === 1
                    ? { border: '#FFD700', bg: '#12151b', badge: '👑', innerShadow: 'inset 0 0 0 1px rgba(255,215,0,0.15)' }
                    : rank === 2
                    ? { border: '#C0C0C0', bg: '#12151b', badge: '🥈', innerShadow: 'inset 0 0 0 1px rgba(192,192,192,0.1)' }
                    : rank === 3
                    ? { border: '#CD7F32', bg: '#12151b', badge: '🥉', innerShadow: 'inset 0 0 0 1px rgba(205,127,50,0.1)' }
                    : null

                  const initial = (entry.name as string).charAt(0).toUpperCase()

                  if (podiumConfig) {
                    return (
                      <div
                        key={entry.userId}
                        className="rounded-xl p-3.5 mb-2.5 flex items-center gap-4 transition-all hover:scale-[1.01]"
                        style={{ border: `2px solid ${podiumConfig.border}`, background: podiumConfig.bg, boxShadow: podiumConfig.innerShadow }}
                      >
                        <div className="text-xl hidden sm:block">{podiumConfig.badge}</div>
                        <div className="text-sm font-bold w-6 text-right" style={{ color: podiumConfig.border }}>{rank}.</div>
                        
                        {entry.avatarUrl ? (
                          <Image
                            src={entry.avatarUrl}
                            alt={entry.name}
                            width={42}
                            height={42}
                            className="rounded-full object-cover border-2"
                            style={{ borderColor: podiumConfig.border }}
                          />
                        ) : (
                          <div
                            className="w-[42px] h-[42px] rounded-full flex items-center justify-center font-bold text-white text-sm shrink-0 border-2"
                            style={{ background: '#2a3140', borderColor: podiumConfig.border }}
                          >
                            {initial}
                          </div>
                        )}

                        <div className="flex-1 flex flex-wrap items-center gap-2.5 min-w-0">
                          <span className="font-bold text-sm truncate text-[#e6eaf2]">{entry.name}</span>
                          {isMe && (
                            <span className="text-[9px] font-bold tracking-[0.15em] text-[#00c2ff] border border-[#00c2ff] px-2 py-0.5 rounded-full shrink-0">
                              VOCÊ
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-end">
                          <span className="text-[#00d68f] font-bold text-xl whitespace-nowrap">
                            {entry.points} <span className="text-[10px] text-[#5d6678] font-normal">pts</span>
                          </span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={entry.userId}
                      className="bg-[#12151b] border border-[#2a3140] rounded-lg p-3 mb-2 flex items-center gap-4 transition-all hover:scale-[1.01]"
                    >
                      <div className="text-xs text-[#5d6678] w-8 text-right">{rank}.</div>
                      
                      {entry.avatarUrl ? (
                        <Image
                          src={entry.avatarUrl}
                          alt={entry.name}
                          width={36}
                          height={36}
                          className="rounded-full object-cover border border-[#2a3140]"
                        />
                      ) : (
                        <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 bg-[#2a3140]">
                          {initial}
                        </div>
                      )}

                      <div className="flex-1 flex flex-wrap items-center gap-2.5 min-w-0">
                        <span className="text-[13px] truncate text-[#e6eaf2]">{entry.name}</span>
                        {isMe && (
                          <span className="text-[9px] font-bold tracking-[0.15em] text-[#00c2ff] border border-[#00c2ff] px-2 py-0.5 rounded-full shrink-0">
                            VOCÊ
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-end">
                        <span className="text-[#e6eaf2] font-bold text-base whitespace-nowrap">
                          {entry.points} <span className="text-[10px] text-[#5d6678] font-normal">pts</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              )}
            </div>
          </section>
        )}

        {/* ABA: CONFIGURAÇÕES */}
        {activeTab === 'settings' && (
          <section className="space-y-6 max-w-2xl mx-auto">
            
            {/* Resumo do Grupo */}
            <div className="bg-[#12151b] border border-[#2a3140] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex gap-6">
                <div>
                  <div className="text-[10px] text-[#5d6678] tracking-widest mb-1 uppercase">Participantes</div>
                  <div className="text-3xl font-bold text-[#00c2ff]">{group.group_members.length}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#5d6678] tracking-widest mb-1 uppercase">Limite Máximo</div>
                  <div className="text-3xl font-bold text-[#00d68f]">{group.player_limit}</div>
                </div>
              </div>
              {currentUserRole === 'owner' && (
                <div className="flex flex-col gap-2">
                  <Link href={`/groups/${group.id}/tv`} className="bg-[#00c2ff]/20 text-[#00c2ff] border border-[#00c2ff]/50 text-xs font-bold px-6 py-3 rounded-lg hover:bg-[#00c2ff] hover:text-black transition flex items-center justify-center gap-2">
                    📺 MODO TV
                  </Link>
                  <Link href={`/groups/${group.id}/upgrade`} className="bg-[#5865F2] text-white text-xs font-bold px-6 py-3 rounded-lg hover:bg-[#4752C4] transition flex items-center justify-center gap-2">
                    🚀 AUMENTAR LIMITE
                  </Link>
                </div>
              )}
            </div>

            {/* Regras de Pontuação */}
            <h2 className="text-[10px] tracking-[0.3em] text-[#5d6678] pt-6 uppercase">REGRAS DE PONTUAÇÃO DO BOLÃO</h2>
            {currentUserRole === 'owner' ? (
              <form action={updateGroupScoringRules.bind(null, group.id) as unknown as (formData: FormData) => void} className="space-y-2">
                {(Object.keys(SCORING_LABELS) as ScoreCategory[]).filter(c => c !== 'ERROU').map(category => {
                  const meta = SCORING_LABELS[category]
                  return (
                    <div key={category} className="bg-[#12151b] border border-[#2a3140] rounded-xl p-4 flex items-center justify-between gap-4" style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm" style={{ color: meta.color }}>{meta.label}</h3>
                        <p className="text-xs text-[#8b94a8] mt-0.5">{meta.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          name={category}
                          defaultValue={scoringRules[category]}
                          min={0}
                          max={100}
                          className="w-16 bg-[#08090b] border border-[#2a3140] rounded text-center text-white font-bold text-sm py-1.5 focus:border-[#00c2ff] focus:outline-none"
                        />
                        <span className="text-xs text-[#5d6678]">pts</span>
                      </div>
                    </div>
                  )
                })}
                <button type="submit" className="w-full bg-[#00c2ff] text-black font-bold text-xs py-2.5 rounded-xl hover:bg-white transition mt-1">
                  SALVAR PONTUAÇÃO
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                {(Object.keys(SCORING_LABELS) as ScoreCategory[]).filter(c => c !== 'ERROU').map(category => {
                  const meta = SCORING_LABELS[category]
                  return (
                    <div key={category} className="bg-[#12151b] border border-[#2a3140] rounded-xl p-4 flex items-center justify-between gap-4" style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-[#e6eaf2]">{meta.label}</h3>
                        <p className="text-xs text-[#8b94a8] mt-0.5">{meta.desc}</p>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full shrink-0" style={{ background: `${meta.color}20`, color: meta.color }}>
                        +{scoringRules[category]} pts
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Administração */}
            <h2 className="text-[10px] tracking-[0.3em] text-[#ff3d57] pt-6 uppercase">ADMINISTRAÇÃO DO BOLÃO</h2>
            <div className="bg-[#08090b] border border-[#ff3d57]/30 rounded-xl p-6">
              <p className="text-xs text-[#8b94a8] mb-6">
                Código de convite: <strong className="text-white bg-[#1f242e] px-2 py-1 rounded ml-1">{group.invite_code}</strong>
              </p>

              <div className="pt-4 border-t border-[#1f242e] flex">
                {currentUserRole === 'owner' ? (
                  <DeleteGroupButton groupId={group.id} />
                ) : (
                  <form action={leaveGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                    <button type="submit" className="bg-transparent border border-[#ffb547] text-[#ffb547] text-xs font-bold px-6 py-2 rounded hover:bg-[#ffb547] hover:text-black transition">
                      Sair do Bolão
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Exportação (owner only) */}
            {currentUserRole === 'owner' && (
              <>
                <h2 className="text-[10px] tracking-[0.3em] text-[#00d68f] pt-6 uppercase">EXPORTAR DADOS DO BOLÃO</h2>
                <div className="bg-[#12151b] border border-[#2a3140] rounded-xl p-6 flex flex-wrap gap-3">
                  <a 
                    href={`/api/groups/${group.id}/export?format=csv`} 
                    className="bg-[#00d68f]/20 text-[#00d68f] border border-[#00d68f]/50 text-xs font-bold px-6 py-3 rounded-lg hover:bg-[#00d68f] hover:text-black transition flex items-center gap-2"
                  >
                    📥 Exportar CSV
                  </a>
                  <a 
                    href={`/api/groups/${group.id}/export?format=pdf`} 
                    className="bg-[#ff3d57]/20 text-[#ff3d57] border border-[#ff3d57]/50 text-xs font-bold px-6 py-3 rounded-lg hover:bg-[#ff3d57] hover:text-white transition flex items-center gap-2"
                  >
                    📄 Exportar PDF
                  </a>
                </div>
              </>
            )}

          </section>
        )}
      </div>
    </div>
  )
}
