import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { saveGuess, deleteGroup, leaveGroup } from './actions'
import { calculateScore } from '@/utils/scoring'

export default async function GroupDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Puxa os dados do Grupo
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, role, profiles(full_name))')
    .eq('id', id)
    .single()

  // 2. Verifica se o user logado é membro desse grupo
  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return <div className="p-10 text-white font-mono">Você não tem acesso a este grupo.</div>
  }

  const currentUserRole = group.group_members.find((m: any) => m.user_id === user.id)?.role

  // 3. Puxa os Jogos
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff', { ascending: true })
    .limit(10)

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
  const leaderboard = group.group_members.map((member: any) => {
    let totalPoints = 0
    
    // Filtra os palpites deste membro
    const memberGuesses = allGuesses?.filter(g => g.user_id === member.user_id) || []
    
    // Conta os pontos
    memberGuesses.forEach(guess => {
      // Achar o jogo correspondente
      const match = matches?.find(m => m.id === guess.match_id)
      
      // Só pontua se o jogo já acabou (FIN) ou estiver ao vivo (LIVE) pra emoção
      if (match && (match.status === 'FIN' || match.status === 'LIVE') && match.score_home !== null && match.score_away !== null) {
        totalPoints += calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away)
      }
    })

    return {
      userId: member.user_id,
      name: member.profiles.full_name || 'Sem Nome',
      points: totalPoints
    }
  })

  // Ordena por maior pontuação
  leaderboard.sort((a: any, b: any) => b.points - a.points)

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6">
      <Link href="/" className="text-xs text-[#5d6678] hover:text-white mb-4 inline-block">
        ← VOLTAR AO INÍCIO
      </Link>
      
      <header className="flex flex-col md:flex-row justify-between md:items-end mb-8 border-b border-[#1f242e] pb-4 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#00c2ff]">BOLÃO:</div>
          <h1 className="font-bold text-3xl tracking-tight text-white uppercase">{group.name}</h1>
          <div className="mt-2 flex gap-3">
            {currentUserRole === 'owner' ? (
              <form action={deleteGroup.bind(null, group.id)}>
                <button type="submit" className="text-xs text-[#ff3d57] border border-[#ff3d57]/50 px-2 py-1 hover:bg-[#ff3d57] hover:text-white transition">
                  Excluir Bolão
                </button>
              </form>
            ) : (
              <form action={leaveGroup.bind(null, group.id)}>
                <button type="submit" className="text-xs text-[#ffb547] border border-[#ffb547]/50 px-2 py-1 hover:bg-[#ffb547] hover:text-black transition">
                  Sair do Bolão
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="bg-[#12151b] border border-[#2a3140] px-4 py-2 flex items-center gap-3">
          <span className="text-[10px] tracking-widest text-[#5d6678]">CÓDIGO DE CONVITE:</span>
          <span className="font-bold text-[#ffb547] text-lg">{group.invite_code}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LADO ESQUERDO: Jogos e Palpites */}
        <section className="lg:col-span-2 space-y-6">
          <h2 className="text-[10px] tracking-[0.3em] text-[#5d6678]">PRÓXIMOS JOGOS</h2>
          
          <div className="space-y-4">
            {matches?.map(match => {
              const guess = guessesMap.get(match.id)
              const hasStarted = match.status !== 'UPC' && new Date(match.kickoff) < new Date()

              let pointsEarned = null;
              if (hasStarted && guess && match.score_home !== null && match.score_away !== null) {
                pointsEarned = calculateScore(guess.score_home, guess.score_away, match.score_home, match.score_away);
              }

              return (
                <div key={match.id} className="bg-[#12151b] border border-[#2a3140] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  
                  {/* Info do Jogo */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="text-[10px] text-[#5d6678] mb-2">
                      {new Date(match.kickoff).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • {match.status === 'LIVE' ? <span className="text-[#ff3d57] animate-pulse">AO VIVO</span> : match.status}
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-4 font-bold text-lg">
                      <span className="text-right w-24 truncate">{match.home_team}</span>
                      <span className="text-[#5d6678] text-xs">vs</span>
                      <span className="text-left w-24 truncate">{match.away_team}</span>
                    </div>
                    {hasStarted && (
                      <div className="text-[10px] text-[#00d68f] mt-1 flex gap-2">
                        <span>Placar Real: {match.score_home ?? 0} x {match.score_away ?? 0}</span>
                        {pointsEarned !== null && (
                          <span className="text-[#ffb547] font-bold">+{pointsEarned} PTS</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Form de Palpite */}
                  <form action={saveGuess as unknown as (formData: FormData) => void} className="flex flex-col items-end gap-2 bg-[#08090b] p-3 border border-[#1f242e]">
                    <input type="hidden" name="matchId" value={match.id} />
                    <input type="hidden" name="groupId" value={group.id} />
                    
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        name="scoreHome" 
                        defaultValue={guess?.score_home ?? ''}
                        disabled={hasStarted}
                        className="w-12 h-10 bg-[#12151b] border border-[#2a3140] text-center text-white font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-50" 
                        placeholder="0"
                        required
                      />
                      <span className="text-[#5d6678]">x</span>
                      <input 
                        type="number" 
                        name="scoreAway" 
                        defaultValue={guess?.score_away ?? ''}
                        disabled={hasStarted}
                        className="w-12 h-10 bg-[#12151b] border border-[#2a3140] text-center text-white font-bold focus:border-[#00c2ff] focus:outline-none disabled:opacity-50" 
                        placeholder="0"
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={hasStarted}
                      className="text-[10px] tracking-widest text-[#00c2ff] border border-[#00c2ff] px-3 py-1 hover:bg-[#00c2ff] hover:text-black transition disabled:opacity-30 disabled:border-[#5d6678] disabled:text-[#5d6678]"
                    >
                      {guess ? 'ATUALIZAR' : 'SALVAR'}
                    </button>
                  </form>

                </div>
              )
            })}
            
            {!matches || matches.length === 0 && (
              <div className="text-center text-[#5d6678] py-10 border border-dashed border-[#2a3140]">
                Nenhum jogo sincronizado ainda. Execute a Fase 3 (API Sync).
              </div>
            )}
          </div>
        </section>

        {/* LADO DIREITO: Ranking */}
        <section className="space-y-6">
          <h2 className="text-[10px] tracking-[0.3em] text-[#ffb547]">LEADERBOARD</h2>
          
          <div className="bg-[#12151b] border border-[#ffb547]/30 p-4">
            <div className="text-xs text-[#8b94a8] mb-4 text-center">
              Pontuação atualizada ao vivo.
            </div>
            
            <div className="space-y-2">
              {leaderboard.map((entry: any, idx: number) => {
                const isMe = entry.userId === user.id
                return (
                  <div key={entry.userId} className={`flex justify-between items-center bg-[#08090b] border ${isMe ? 'border-[#00c2ff]' : 'border-[#2a3140]'} p-3`}>
                    <span className={`font-bold ${isMe ? 'text-[#00c2ff]' : 'text-[#e6eaf2]'} text-sm truncate`}>
                      {idx + 1}. {isMe ? 'VOCÊ' : entry.name}
                    </span>
                    <span className="text-[#00d68f] font-bold ml-4">{entry.points} pts</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Área do Admin (só aparece se for owner) */}
          {currentUserRole === 'owner' && (
            <div className="mt-8 bg-[#08090b] border border-[#ff3d57]/30 p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-2 h-full bg-[#ff3d57]"></div>
              <h3 className="text-[10px] tracking-[0.3em] text-[#ff3d57] mb-2 font-bold">PAINEL DO DONO DO BOLÃO</h3>
              <p className="text-xs text-[#8b94a8] mb-3">Compartilhe o código <strong>{group.invite_code}</strong> com seus amigos.</p>
              <div className="text-xs">
                Membros no grupo: <span className="font-bold text-white">{group.group_members.length} / {group.player_limit}</span>
              </div>
              <div className="mt-4">
                <Link href={`/groups/${group.id}/upgrade`} className="bg-[#ff3d57] text-white text-xs font-bold px-4 py-2 hover:bg-[#ff1a38] transition w-full block text-center">
                  ⚡ AUMENTAR LIMITE DE JOGADORES
                </Link>
              </div>
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
