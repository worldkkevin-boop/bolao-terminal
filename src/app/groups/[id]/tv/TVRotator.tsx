'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import TeamLogo from '@/components/TeamLogo'

type TVRotatorProps = {
  group: any
  leaderboard: any[]
  upcomingMatches: any[]
  recentMatches: any[]
}

export default function TVRotator({ group, leaderboard, upcomingMatches, recentMatches }: TVRotatorProps) {
  const router = useRouter()
  const [matchIndex, setMatchIndex] = useState(0)
  const [hideCursor, setHideCursor] = useState(false)

  // Combina jogos futuros e recentes para o carrossel central
  const carouselMatches = [
    ...(upcomingMatches.slice(0, 2).map(m => ({ ...m, type: 'upcoming' }))),
    ...(recentMatches.slice(0, 1).map(m => ({ ...m, type: 'recent' })))
  ]

  // Rotação do match em destaque (10s)
  useEffect(() => {
    if (carouselMatches.length <= 1) return
    const interval = setInterval(() => {
      setMatchIndex((prev) => (prev + 1) % carouselMatches.length)
    }, 10000)
    return () => clearInterval(interval)
  }, [carouselMatches.length])

  // Refresh de dados pesados (60s)
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 60000)
    return () => clearInterval(interval)
  }, [router])

  // Esconder cursor por inatividade
  useEffect(() => {
    let timeout: NodeJS.Timeout
    const handleActivity = () => {
      setHideCursor(false)
      clearTimeout(timeout)
      timeout = setTimeout(() => setHideCursor(true), 3000)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    handleActivity()

    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      clearTimeout(timeout)
    }
  }, [])

  const currentMatch = carouselMatches[matchIndex]
  const top5 = leaderboard.slice(0, 5)

  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#08090b] to-[#0d1117] text-[#e6eaf2] font-mono p-8 flex flex-col transition-all duration-1000 relative overflow-hidden ${hideCursor ? 'cursor-none' : ''}`}>
      
      {/* Botão de Saída */}
      <div className={`absolute top-4 right-4 transition-opacity duration-500 z-50 ${hideCursor ? 'opacity-0' : 'opacity-100'}`}>
        <Link 
          href={`/groups/${group.id}`} 
          className="text-[10px] text-[#5d6678] border border-[#2a3140] px-3 py-1.5 rounded-md tracking-[0.15em] hover:bg-[#2a3140] hover:text-white transition"
        >
          SAIR DO MODO TV ×
        </Link>
      </div>

      {/* Header Fixo */}
      <header className="text-center mb-8 flex-none">
        <div className="text-[11px] tracking-[0.4em] text-[#00c2ff] mb-1">BOLÃO ATIVO</div>
        <h1 className="text-5xl font-bold tracking-tight uppercase leading-none">{group.name}</h1>
        <div className="text-[11px] text-[#5d6678] mt-3 tracking-[0.2em] uppercase">
          CÓDIGO {group.invite_code} · {group.group_members.length} JOGADORES
        </div>
      </header>

      <main className="flex-grow flex flex-col max-w-4xl mx-auto w-full">
        {/* Match em Destaque */}
        <div className="relative h-[160px] mb-8">
          {carouselMatches.map((match, idx) => {
            const isUpcoming = match.type === 'upcoming'
            const borderColor = isUpcoming ? '#ffb547' : '#00d68f'
            const bgClass = isUpcoming ? 'bg-[#ffb547]/5 border-[#ffb547]/30' : 'bg-[#00d68f]/5 border-[#00d68f]/30'
            const titleColor = isUpcoming ? 'text-[#ffb547]' : 'text-[#00d68f]'
            const title = isUpcoming ? 'PRÓXIMO JOGO' : 'ÚLTIMO RESULTADO'
            
            // Calculando countdown estático pro TV Mode para não ter dependência cliente pesada
            // Ideal seria ter o contador dinâmico, mas simplificamos pro visual.
            const dateObj = new Date(match.kickoff)
            const dateString = dateObj.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo' })

            return (
              <div 
                key={match.id + idx}
                className={`absolute inset-0 border rounded-xl p-6 flex items-center justify-between transition-all duration-1000 ${bgClass} ${matchIndex === idx ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0'}`}
              >
                <div>
                  <div className={`text-[10px] tracking-[0.3em] mb-4 uppercase ${titleColor}`}>{title}</div>
                  <div className="flex items-center gap-4">
                    <TeamLogo teamId={match.home_team_id} teamName={match.home_team} size="lg" />
                    <div className="text-2xl font-bold truncate max-w-[150px]">{match.home_team}</div>
                    <div className="text-sm text-[#5d6678] mx-2">VS</div>
                    <div className="text-2xl font-bold truncate max-w-[150px]">{match.away_team}</div>
                    <TeamLogo teamId={match.away_team_id} teamName={match.away_team} size="lg" />
                  </div>
                </div>
                <div className="text-right flex flex-col items-end justify-center">
                  {match.status === 'FIN' || match.status === 'LIVE' ? (
                    <>
                      <div className={`text-4xl font-bold ${titleColor}`}>
                        {match.score_home} - {match.score_away}
                      </div>
                      <div className="text-[11px] text-[#5d6678] mt-2 tracking-widest uppercase">{match.status === 'LIVE' ? 'AO VIVO' : 'FINALIZADO'}</div>
                    </>
                  ) : (
                    <>
                      <div className={`text-3xl font-bold ${titleColor}`}>
                        {dateString.split(' ')[1]} {/* Hora */}
                      </div>
                      <div className="text-[11px] text-[#5d6678] mt-2 tracking-widest uppercase">{dateString.split(' ')[0]}</div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Ranking Fixo */}
        <div className="flex-grow flex flex-col">
          <div className="text-[11px] tracking-[0.3em] text-[#5d6678] mb-3">RANKING TOP 5</div>
          <div className="grid grid-cols-1 gap-2">
            {top5.map((entry, idx) => {
              const rank = idx + 1
              const podiumConfig = rank === 1
                ? { border: '#FFD700', bg: 'rgba(255,215,0,0.08)', badge: '👑' }
                : rank === 2
                ? { border: '#C0C0C0', bg: 'rgba(192,192,192,0.06)', badge: '🥈' }
                : rank === 3
                ? { border: '#CD7F32', bg: 'rgba(205,127,50,0.06)', badge: '🥉' }
                : { border: '#2a3140', bg: '#12151b', badge: '' }

              const initial = (entry.name as string).charAt(0).toUpperCase()

              return (
                <div 
                  key={entry.userId}
                  className="rounded-lg px-5 py-3 flex items-center gap-4 shadow-sm"
                  style={{ borderLeft: `4px solid ${podiumConfig.border}`, background: podiumConfig.bg }}
                >
                  <div className="text-2xl w-8 text-center">{podiumConfig.badge || <span className="text-xl font-bold text-[#5d6678]">{rank}</span>}</div>
                  
                  {entry.avatarUrl ? (
                    <Image src={entry.avatarUrl} alt={entry.name} width={40} height={40} className="rounded-full object-cover border-2" style={{ borderColor: podiumConfig.border }} />
                  ) : (
                    <div className="w-[40px] h-[40px] rounded-full flex items-center justify-center font-bold text-white text-base shrink-0 border-2" style={{ background: '#2a3140', borderColor: podiumConfig.border }}>
                      {initial}
                    </div>
                  )}

                  <div className="flex-1 font-bold text-lg text-white truncate">{entry.name}</div>
                  
                  <div className="text-right">
                    <span className="text-2xl font-bold" style={{ color: rank <= 3 ? podiumConfig.border : '#e6eaf2' }}>{entry.points}</span>
                    <span className="text-xs text-[#5d6678] ml-1.5 font-normal">pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Dots do Carrossel */}
        {carouselMatches.length > 1 && (
          <div className="flex justify-center gap-2 mt-8 flex-none">
            {carouselMatches.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${matchIndex === idx ? 'bg-[#00c2ff] scale-125' : 'bg-[#2a3140]'}`}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
