'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import TeamLogo from '@/components/TeamLogo'
import MatchCountdown from '@/components/MatchCountdown'
import { computeInitialLabel } from '@/utils/countdown'

type TVRotatorProps = {
  group: any
  leaderboard: any[]
  upcomingMatches: any[]
  recentMatches: any[]
}

export default function TVRotator({ group, leaderboard, upcomingMatches, recentMatches }: TVRotatorProps) {
  const router = useRouter()
  const [screenIndex, setScreenIndex] = useState(0)
  const [hideCursor, setHideCursor] = useState(false)

  // Rotação de telas (15s)
  useEffect(() => {
    const screens = [
      true, // Screen 0: Ranking
      upcomingMatches.length > 0, // Screen 1: Upcoming
      recentMatches.length > 0 // Screen 2: Recent
    ]
    
    const interval = setInterval(() => {
      setScreenIndex((prev) => {
        let next = (prev + 1) % 3
        // Pula telas sem dados
        while (!screens[next] && next !== prev) {
          next = (next + 1) % 3
        }
        return next
      })
    }, 15000)

    return () => clearInterval(interval)
  }, [upcomingMatches.length, recentMatches.length])

  // Refresh de dados (60s)
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 60000)
    return () => clearInterval(interval)
  }, [router])

  // Lógica de inatividade para esconder cursor
  useEffect(() => {
    let timeout: NodeJS.Timeout

    const handleActivity = () => {
      setHideCursor(false)
      clearTimeout(timeout)
      timeout = setTimeout(() => setHideCursor(true), 3000)
    }

    // Previne scroll
    document.body.style.overflow = 'hidden'
    
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('keydown', handleActivity)
    
    handleActivity() // init

    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className={`min-h-screen bg-[#040508] text-[#e6eaf2] font-mono flex flex-col transition-all duration-1000 ${hideCursor ? 'cursor-none' : ''}`}>
      
      {/* Botão de saída (fica no topo direito) */}
      <div className={`absolute top-6 right-6 z-50 transition-opacity duration-500 ${hideCursor ? 'opacity-0' : 'opacity-100'}`}>
        <Link 
          href={`/groups/${group.id}`} 
          className="bg-[#ff3d57]/20 border border-[#ff3d57]/50 text-[#ff3d57] px-4 py-2 rounded-lg font-bold hover:bg-[#ff3d57] hover:text-white transition"
        >
          Sair do Modo TV ✖
        </Link>
      </div>

      {/* Header Fixo */}
      <header className="flex-none p-8 flex items-center justify-between border-b border-[#1f242e] bg-gradient-to-b from-[#0a0c10] to-[#040508]">
        <div className="flex flex-col">
          <span className="text-xl tracking-[0.3em] text-[#00c2ff]">BOLÃO CORPORATIVO</span>
          <h1 className="text-5xl font-bold tracking-tight text-white uppercase mt-2">{group.name}</h1>
        </div>
        <div className="flex gap-8 text-right">
          <div>
            <div className="text-sm tracking-widest text-[#5d6678] uppercase mb-1">Membros</div>
            <div className="text-3xl font-bold text-[#00d68f]">{group.group_members.length} / {group.player_limit}</div>
          </div>
          <div>
            <div className="text-sm tracking-widest text-[#5d6678] uppercase mb-1">Convite</div>
            <div className="text-3xl font-bold text-[#ffb547] bg-[#1f242e] px-4 rounded">{group.invite_code}</div>
          </div>
        </div>
      </header>

      {/* Container Principal com Fade Transitons */}
      <main className="flex-grow flex items-center justify-center p-8 relative overflow-hidden">
        
        {/* TELA 0: RANKING TOP 10 */}
        <div className={`absolute inset-0 flex flex-col p-8 transition-opacity duration-1000 ${screenIndex === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          <h2 className="text-3xl font-bold text-[#ffb547] mb-8 uppercase tracking-widest text-center">🏆 TOP 10 RANKING GERAL</h2>
          <div className="flex-grow grid grid-cols-2 gap-6 max-w-6xl mx-auto w-full">
            {leaderboard.map((entry, idx) => {
              const rank = idx + 1
              const podiumConfig = rank === 1
                ? { border: '#FFD700', bg: 'rgba(255,215,0,0.1)', badge: '👑', size: 'scale-110' }
                : rank === 2
                ? { border: '#C0C0C0', bg: 'rgba(192,192,192,0.08)', badge: '🥈', size: 'scale-105' }
                : rank === 3
                ? { border: '#CD7F32', bg: 'rgba(205,127,50,0.08)', badge: '🥉', size: 'scale-105' }
                : { border: '#2a3140', bg: '#0a0c10', badge: `${rank}.`, size: 'scale-100' }

              return (
                <div 
                  key={entry.userId} 
                  className={`flex items-center justify-between p-6 rounded-2xl border transition-all ${podiumConfig.size}`}
                  style={{ borderColor: podiumConfig.border, background: podiumConfig.bg }}
                >
                  <div className="flex items-center gap-6">
                    <span className="w-12 text-right text-3xl font-bold" style={{ color: podiumConfig.border }}>
                      {podiumConfig.badge}
                    </span>
                    {entry.avatarUrl ? (
                      <Image src={entry.avatarUrl} alt={entry.name} width={70} height={70} className="rounded-full border-4" style={{ borderColor: podiumConfig.border }} />
                    ) : (
                      <div className="w-[70px] h-[70px] rounded-full flex items-center justify-center text-2xl font-bold text-black" style={{ background: podiumConfig.border }}>
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-2xl text-white truncate max-w-[250px]">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-bold" style={{ color: rank <= 3 ? podiumConfig.border : '#00d68f' }}>{entry.points}</span>
                    <span className="text-lg text-[#5d6678] ml-2">pts</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* TELA 1: PRÓXIMOS JOGOS */}
        <div className={`absolute inset-0 flex flex-col p-8 transition-opacity duration-1000 ${screenIndex === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          <h2 className="text-3xl font-bold text-[#00c2ff] mb-12 uppercase tracking-widest text-center">⏳ PRÓXIMOS JOGOS</h2>
          <div className="flex-grow flex flex-col gap-8 max-w-5xl mx-auto w-full justify-center pb-20">
            {upcomingMatches.map((match) => {
              const { label, urgent } = computeInitialLabel(match.kickoff)
              return (
                <div key={match.id} className="bg-[#0a0c10] border border-[#2a3140] p-8 rounded-3xl flex items-center justify-between shadow-xl">
                  <div className="flex flex-col flex-1 items-center">
                    <TeamLogo teamId={match.home_team_id} teamName={match.home_team} size="lg" />
                    <span className="text-2xl font-bold text-white">{match.home_team}</span>
                  </div>
                  <div className="flex flex-col items-center px-12 min-w-[300px]">
                    <span className="text-xl text-[#5d6678] font-bold tracking-widest mb-4 uppercase">VS</span>
                    <MatchCountdown kickoff={match.kickoff} initialLabel={label} initialUrgent={urgent} />
                  </div>
                  <div className="flex flex-col flex-1 items-center">
                    <TeamLogo teamId={match.away_team_id} teamName={match.away_team} size="lg" />
                    <span className="text-2xl font-bold text-white">{match.away_team}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* TELA 2: ÚLTIMOS RESULTADOS */}
        <div className={`absolute inset-0 flex flex-col p-8 transition-opacity duration-1000 ${screenIndex === 2 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}>
          <h2 className="text-3xl font-bold text-[#00d68f] mb-12 uppercase tracking-widest text-center">✅ ÚLTIMOS RESULTADOS</h2>
          <div className="flex-grow flex flex-col gap-8 max-w-5xl mx-auto w-full justify-center pb-20">
            {recentMatches.map((match) => (
              <div key={match.id} className="bg-[#0a0c10] border border-[#2a3140] p-8 rounded-3xl flex items-center justify-between shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00d68f] to-transparent opacity-20"></div>
                <div className="flex flex-col flex-1 items-center">
                  <TeamLogo teamId={match.home_team_id} teamName={match.home_team} size="lg" />
                  <span className="text-2xl font-bold text-white">{match.home_team}</span>
                </div>
                <div className="flex flex-col items-center px-12">
                  <div className="text-sm tracking-widest text-[#5d6678] uppercase mb-4">{new Date(match.kickoff).toLocaleDateString('pt-BR')}</div>
                  <div className="bg-[#1f242e] border border-[#00d68f]/30 px-8 py-4 rounded-xl font-bold text-[#00d68f] text-6xl shadow-[0_0_30px_rgba(0,214,143,0.15)]">
                    {match.score_home} - {match.score_away}
                  </div>
                </div>
                <div className="flex flex-col flex-1 items-center">
                  <TeamLogo teamId={match.away_team_id} teamName={match.away_team} size="lg" />
                  <span className="text-2xl font-bold text-white">{match.away_team}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* Footer / Progress Bar */}
      <footer className="h-2 bg-[#1f242e]">
        <div 
          className="h-full bg-gradient-to-r from-[#00c2ff] via-[#00d68f] to-[#ffb547]" 
          style={{
             width: '100%',
             animation: 'shrink 15s linear infinite'
          }}
        />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shrink {
            0% { width: 0%; }
            100% { width: 100%; }
          }
        `}} />
      </footer>
    </div>
  )
}
