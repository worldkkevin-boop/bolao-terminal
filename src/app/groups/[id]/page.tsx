import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { saveGuess, deleteGroup, leaveGroup } from './actions'
import { calculateScore } from '@/utils/scoring'
import MatchCountdown, { computeInitialLabel } from '@/components/MatchCountdown'

const flagsMap: Record<string, string> = {
  'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
  'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Italy': '🇮🇹',
  'Netherlands': '🇳🇱', 'Uruguay': '🇺🇾', 'Croatia': '🇭🇷', 'Belgium': '🇧🇪',
  'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Mexico': '🇲🇽',
  'USA': '🇺🇸', 'Canada': '🇨🇦', 'Japan': '🇯🇵', 'South Korea': '🇰🇷',
  'Czech Republic': '🇨🇿', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
  'Bosnia & Herzegovina': '🇧🇦'
}
function getFlagEmoji(teamName: string) {
  return flagsMap[teamName] || '🛡️'
}

export default async function GroupDashboard({ 
  params,
  searchParams
}: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const { tab, filter } = await searchParams
  const activeTab = typeof tab === 'string' ? tab : 'matches'
  const validFilters = ['upcoming', 'live', 'finished'] as const
  const activeFilter = typeof filter === 'string' && validFilters.includes(filter as any) ? filter as typeof validFilters[number] : 'upcoming'

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

  // 3. Puxa os Jogos (filtrados por status) + counts em paralelo
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

  // ==========================
  // CÁLCULO DO LEADERBOARD
  // ==========================

  // Lookup O(1) de matches por id (evita .find() repetido)
  const matchesMap = new Map(matches?.map(m => [m.id, m]) || [])

  // Agrupa guesses por user_id uma vez só (evita .filter() repetido)
  const guessesByUser = new Map<string, typeof allGuesses>()
  for (const g of allGuesses || []) {
    const list = guessesByUser.get(g.user_id)
    if (list) {
      list.push(g)
    } else {
      guessesByUser.set(g.user_id, [g])
    }
  }

  const leaderboard = group.group_members.map((member: any) => {
    let totalPoints = 0
    
    // Pega os palpites do membro via Map — O(1)
    const memberGuesses = guessesByUser.get(member.user_id) || []
    
    // Conta os pontos
    memberGuesses.forEach(guess => {
      // Lookup O(1) no Map ao invés de .find()
      const match = matchesMap.get(guess.match_id)
      
      // Só pontua se o jogo já acabou (FIN) ou estiver ao vivo (LIVE) pra emoção
      if (match && (match.status === 'FIN' || match.status === 'LIVE') && match.score_home !== null && match.score_away !== null) {
        totalPoints += calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away)
      }
    })

    return {
      userId: member.user_id,
      name: member.profiles.full_name || 'Sem Nome',
      avatarUrl: member.profiles.avatar_url || null,
      points: totalPoints
    }
  })

  // Ordena por maior pontuação
  leaderboard.sort((a: any, b: any) => b.points - a.points)

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6">
      <Link href="/" className="text-xs text-[#5d6678] hover:text-white mb-4 inline-block">
        ← VOLTAR AO INÍCIO
      </Link>
      
      <header className="flex flex-col md:flex-row justify-between md:items-end mb-8 border-b border-[#1f242e] pb-4 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#00c2ff]">BOLÃO:</div>
          <h1 className="font-bold text-3xl tracking-tight text-white uppercase">{group.name}</h1>
          <div className="mt-2 flex gap-3">
            {currentUserRole === 'owner' ? (
              <form action={deleteGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                <button type="submit" className="text-xs text-[#ff3d57] border border-[#ff3d57]/50 px-2 py-1 hover:bg-[#ff3d57] hover:text-white transition">
                  Excluir Bolão
                </button>
              </form>
            ) : (
              <form action={leaveGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                <button type="submit" className="text-xs text-[#ffb547] border border-[#ffb547]/50 px-2 py-1 hover:bg-[#ffb547] hover:text-black transition">
                  Sair do Bolão
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="bg-[#12151b] border border-[#2a3140] px-4 py-2 flex items-center gap-3 rounded">
          <span className="text-[10px] tracking-widest text-[#5d6678]">CÓDIGO DE CONVITE:</span>
          <span className="font-bold text-[#ffb547] text-lg">{group.invite_code}</span>
        </div>
      </header>

      {/* Menu de Abas */}
      <div className="flex gap-6 border-b border-[#1f242e] mb-8 overflow-x-auto no-scrollbar">
        <Link 
          href={`/groups/${group.id}?tab=matches`} 
          className={`pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap ${activeTab === 'matches' ? 'text-[#00c2ff] border-b-2 border-[#00c2ff]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          Partidas
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=ranking`} 
          className={`pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap ${activeTab === 'ranking' ? 'text-[#ffb547] border-b-2 border-[#ffb547]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          Ranking
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=settings`} 
          className={`pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap ${activeTab === 'settings' ? 'text-[#00d68f] border-b-2 border-[#00d68f]' : 'text-[#5d6678] hover:text-[#e6eaf2] transition'}`}
        >
          Configurações
        </Link>
      </div>

      <div className="min-h-[50vh]">
        
        {/* ABA: PARTIDAS */}
        {activeTab === 'matches' && (
          <section className="space-y-6 max-w-3xl mx-auto">

            {/* Sub-filtro: Futuras / Ao vivo / Encerradas */}
            <div className="flex gap-2 justify-center">
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
                    className={`text-[10px] md:text-xs font-bold tracking-wider px-4 py-2 rounded-full border transition-all ${
                      isActive
                        ? 'text-black'
                        : 'text-[#8b94a8] border-[#2a3140] hover:border-[#5d6678]'
                    } ${hasLive && !isActive ? 'animate-pulse' : ''}`}
                    style={isActive ? { background: f.color, borderColor: f.color } : hasLive ? { borderColor: f.color, color: f.color } : {}}
                  >
                    {f.label} ({f.count})
                  </Link>
                )
              })}
            </div>

            <div className="space-y-4">
              {matches?.map(match => {
                const guess = guessesMap.get(match.id)
                const hasStarted = match.status !== 'UPC' && new Date(match.kickoff) < new Date()

                let pointsEarned = null;
                if (hasStarted && guess && match.score_home !== null && match.score_away !== null) {
                  pointsEarned = calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away);
                }

                return (
                  <div key={match.id} className="bg-[#12151b] border border-[#2a3140] p-4 md:p-6 rounded-2xl flex flex-col items-center justify-between gap-6 shadow-sm">
                    
                    {/* Header do Jogo */}
                    <div className="text-[10px] tracking-widest text-[#5d6678] uppercase w-full text-center border-b border-[#1f242e] pb-3">
                      {new Date(match.kickoff).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • {match.status === 'LIVE' ? <span className="text-[#ff3d57] font-bold animate-pulse">AO VIVO</span> : match.status}
                    </div>

                    {/* Escudos e Nomes */}
                    <div className="flex items-center justify-between w-full px-2 md:px-8">
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-4xl mb-2 drop-shadow-lg">{getFlagEmoji(match.home_team)}</span>
                        <span className="text-xs md:text-sm font-bold truncate text-center w-full">{match.home_team}</span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center px-4">
                        <span className="text-[#5d6678] text-[10px] uppercase tracking-widest mb-1">VS</span>
                        {hasStarted && (
                          <div className="bg-[#1f242e] px-3 py-1 rounded font-bold text-[#00d68f] text-sm">
                            {match.score_home ?? 0} - {match.score_away ?? 0}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-4xl mb-2 drop-shadow-lg">{getFlagEmoji(match.away_team)}</span>
                        <span className="text-xs md:text-sm font-bold truncate text-center w-full">{match.away_team}</span>
                      </div>
                    </div>

                    {/* Countdown ao vivo */}
                    {!hasStarted && (() => {
                      const { label, urgent } = computeInitialLabel(match.kickoff)
                      return (
                        <MatchCountdown kickoff={match.kickoff} initialLabel={label} initialUrgent={urgent} />
                      )
                    })()}

                    {hasStarted && pointsEarned !== null && (
                      <div className="text-xs text-[#ffb547] font-bold">
                        +{pointsEarned} PONTOS CONQUISTADOS
                      </div>
                    )}

                    {/* Form de Palpite */}
                    <form action={saveGuess as unknown as (formData: FormData) => void} className="flex flex-col items-center gap-3 bg-[#08090b] p-4 rounded-lg border border-[#1f242e] shadow-inner">
                      <input type="hidden" name="matchId" value={match.id} />
                      <input type="hidden" name="groupId" value={group.id} />
                      
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          name="scoreHome" 
                          defaultValue={guess?.score_home ?? ''}
                          disabled={hasStarted}
                          className="w-12 h-12 bg-[#12151b] border border-[#2a3140] rounded-md text-center text-white text-lg font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-50" 
                          placeholder="0"
                          required
                        />
                        <span className="text-[#5d6678] font-bold">x</span>
                        <input 
                          type="number" 
                          name="scoreAway" 
                          defaultValue={guess?.score_away ?? ''}
                          disabled={hasStarted}
                          className="w-12 h-12 bg-[#12151b] border border-[#2a3140] rounded-md text-center text-white text-lg font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-50" 
                          placeholder="0"
                          required
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={hasStarted}
                        className="text-[10px] font-bold tracking-widest text-black bg-[#00c2ff] px-6 py-2 rounded-full hover:bg-white transition disabled:opacity-30 disabled:bg-[#2a3140] disabled:text-[#5d6678]"
                      >
                        {guess ? 'ATUALIZAR' : 'SALVAR'}
                      </button>
                    </form>

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
        )}

        {/* ABA: RANKING */}
        {activeTab === 'ranking' && (
          <section className="space-y-6 max-w-2xl mx-auto">
            <div className="bg-[#12151b] border border-[#ffb547]/30 rounded-xl p-6">
              <div className="text-xs text-[#8b94a8] mb-6 text-center uppercase tracking-widest">
                Pontuação atualizada em tempo real
              </div>
              
              <div className="space-y-3">
                {leaderboard.map((entry: any, idx: number) => {
                  const isMe = entry.userId === user.id
                  const rank = idx + 1
                  const podiumConfig = rank === 1
                    ? { border: '#FFD700', bg: 'rgba(255,215,0,0.06)', badge: '👑' }
                    : rank === 2
                    ? { border: '#C0C0C0', bg: 'rgba(192,192,192,0.05)', badge: '🥈' }
                    : rank === 3
                    ? { border: '#CD7F32', bg: 'rgba(205,127,50,0.05)', badge: '🥉' }
                    : null

                  const borderColor = podiumConfig ? podiumConfig.border : (isMe ? '#00c2ff' : '#2a3140')
                  const bgStyle = podiumConfig ? podiumConfig.bg : 'transparent'
                  const initial = (entry.name as string).charAt(0).toUpperCase()

                  return (
                    <div
                      key={entry.userId}
                      className="flex justify-between items-center rounded-lg p-4 shadow-sm transition-all hover:scale-[1.01]"
                      style={{ border: `1px solid ${borderColor}`, background: `linear-gradient(135deg, ${bgStyle}, #08090b)` }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Posição */}
                        <span className="w-8 text-right text-sm font-bold" style={{ color: podiumConfig ? podiumConfig.border : '#5d6678' }}>
                          {podiumConfig ? podiumConfig.badge : `${rank}.`}
                        </span>

                        {/* Avatar */}
                        {entry.avatarUrl ? (
                          <Image
                            src={entry.avatarUrl}
                            alt={entry.name}
                            width={40}
                            height={40}
                            className="rounded-full object-cover"
                            style={{ border: `2px solid ${podiumConfig ? podiumConfig.border : '#2a3140'}` }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0"
                            style={{ background: podiumConfig ? podiumConfig.border : '#5d6678', border: `2px solid ${podiumConfig ? podiumConfig.border : '#2a3140'}` }}
                          >
                            {initial}
                          </div>
                        )}

                        {/* Nome + Label */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-bold text-sm truncate ${isMe ? 'text-[#00c2ff]' : 'text-[#e6eaf2]'}`}>
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="text-[9px] font-bold tracking-widest bg-[#00c2ff]/20 text-[#00c2ff] px-2 py-0.5 rounded-full shrink-0">
                              VOCÊ
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Pontuação */}
                      <span className="text-[#00d68f] font-bold ml-4 text-lg whitespace-nowrap">
                        {entry.points} <span className="text-xs text-[#5d6678]">pts</span>
                      </span>
                    </div>
                  )
                })}
              </div>
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
                <Link href={`/groups/${group.id}/upgrade`} className="bg-[#5865F2] text-white text-xs font-bold px-6 py-3 rounded-lg hover:bg-[#4752C4] transition flex items-center justify-center gap-2">
                  🚀 AUMENTAR LIMITE
                </Link>
              )}
            </div>

            {/* Regras de Pontuação */}
            <h2 className="text-[10px] tracking-[0.3em] text-[#5d6678] pt-6 uppercase">REGRAS DE PONTUAÇÃO DO BOLÃO</h2>
            <div className="space-y-3">
              <div className="bg-[#12151b] border-l-4 border-l-[#00d68f] border-[#2a3140] rounded-r-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-[#e6eaf2]">Placar Exato</h3>
                  <span className="bg-[#00d68f]/20 text-[#00d68f] px-3 py-1 rounded-full text-xs font-bold">+30 pts</span>
                </div>
                <p className="text-xs text-[#8b94a8]">Você cravou o placar. Ex: Palpitou 2x1 e o jogo terminou 2x1.</p>
              </div>

              <div className="bg-[#12151b] border-l-4 border-l-[#5865F2] border-[#2a3140] rounded-r-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-[#e6eaf2]">Vencedor e Saldo</h3>
                  <span className="bg-[#5865F2]/20 text-[#5865F2] px-3 py-1 rounded-full text-xs font-bold">+18 pts</span>
                </div>
                <p className="text-xs text-[#8b94a8]">Acertou quem ganhou e a diferença de gols, mas errou o placar.</p>
              </div>

              <div className="bg-[#12151b] border-l-4 border-l-[#ffb547] border-[#2a3140] rounded-r-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-[#e6eaf2]">Vencedor</h3>
                  <span className="bg-[#ffb547]/20 text-[#ffb547] px-3 py-1 rounded-full text-xs font-bold">+15 pts</span>
                </div>
                <p className="text-xs text-[#8b94a8]">Acertou apenas quem venceu o jogo.</p>
              </div>
            </div>

            {/* Administração */}
            <h2 className="text-[10px] tracking-[0.3em] text-[#ff3d57] pt-6 uppercase">ADMINISTRAÇÃO DO BOLÃO</h2>
            <div className="bg-[#08090b] border border-[#ff3d57]/30 rounded-xl p-6">
              <p className="text-xs text-[#8b94a8] mb-6">
                Código de convite: <strong className="text-white bg-[#1f242e] px-2 py-1 rounded ml-1">{group.invite_code}</strong>
              </p>

              <div className="pt-4 border-t border-[#1f242e] flex">
                {currentUserRole === 'owner' ? (
                  <form action={deleteGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                    <button type="submit" className="bg-transparent border border-[#ff3d57] text-[#ff3d57] text-xs font-bold px-6 py-2 rounded hover:bg-[#ff3d57] hover:text-white transition">
                      Excluir Bolão Permanentemente
                    </button>
                  </form>
                ) : (
                  <form action={leaveGroup.bind(null, group.id) as unknown as (formData: FormData) => void}>
                    <button type="submit" className="bg-transparent border border-[#ffb547] text-[#ffb547] text-xs font-bold px-6 py-2 rounded hover:bg-[#ffb547] hover:text-black transition">
                      Sair do Bolão
                    </button>
                  </form>
                )}
              </div>
            </div>

          </section>
        )}
      </div>
    </div>
  )
}
