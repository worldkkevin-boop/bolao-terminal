import { NextResponse } from 'next/server'
// Importamos uma lib do supabase que bypassa RLS para uso em backend
import { createClient } from '@supabase/supabase-js'
import { calculateScore } from '@/utils/scoring'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // PRECISA CRIAR ISSO NO .env.local!
)

const API_BASE = 'https://v3.football.api-sports.io'
const LEAGUE_ID = 1 // COPA 2026
const SEASON = 2026

export async function GET(request: Request) {
  // Proteger essa rota com uma chave secreta para não chamarem de fora
  const { searchParams } = new URL(request.url)
  if (searchParams.get('secret') !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const API_KEY = process.env.API_SPORTS_KEY
  if (!API_KEY) {
    return NextResponse.json({ error: 'API_SPORTS_KEY não configurada' }, { status: 500 })
  }

  try {
    // 1. Busca os jogos na API real
    const targetURL = `${API_BASE}/fixtures?league=${LEAGUE_ID}&season=${SEASON}`
    const apiRes = await fetch(targetURL, {
      headers: { 'x-apisports-key': API_KEY },
      // Cache-control dependendo de como rodarmos isso
      next: { revalidate: 60 } 
    })

    if (!apiRes.ok) throw new Error('Falha na API-Football')
    const json = await apiRes.json()
    const partidas = json.response || []

    // 2. Prepara os dados para o Supabase
    const upsertData = partidas.map((p: any) => {
      const shortStatus = p.fixture.status.short
      let mappedStatus = 'UPC'
      let min = null

      if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(shortStatus)) {
        mappedStatus = 'LIVE'
        min = p.fixture.status.elapsed ? p.fixture.status.elapsed + "'" : 'AO VIVO'
      } else if (['FT', 'AET', 'PEN', 'CANC', 'ABD'].includes(shortStatus)) {
        mappedStatus = 'FIN'
        min = 'FIM'
      }

      return {
        id: p.fixture.id,
        league_id: p.league.id,
        season: p.league.season,
        home_team: p.teams.home.name,
        home_team_id: p.teams.home.id,
        away_team: p.teams.away.name,
        away_team_id: p.teams.away.id,
        kickoff: new Date(p.fixture.date).toISOString(),
        status: mappedStatus,
        score_home: p.goals.home,
        score_away: p.goals.away,
        minute: min,
        round: p.league.round,
        updated_at: new Date().toISOString()
      }
    })

    // 2.5 Buscar status atual das partidas antes do upsert para saber quem transicionou para FIN
    const matchIds = upsertData.map(m => m.id)
    const { data: oldMatches } = await supabaseAdmin
      .from('matches')
      .select('id, status')
      .in('id', matchIds)
    const oldStatusMap = new Map(oldMatches?.map(m => [m.id, m.status]) || [])

    // 3. Salva no banco de dados (matches)
    if (upsertData.length > 0) {
      const { error } = await supabaseAdmin
        .from('matches')
        .upsert(upsertData, { onConflict: 'id' })

      if (error) {
        console.error('Erro ao fazer upsert:', error)
        return NextResponse.json({ error: 'Falha ao gravar no Supabase' }, { status: 500 })
      }
    }

    // 4. Recalcular e atualizar pontos para partidas recém-finalizadas
    const newlyFinishedMatches = upsertData.filter(m => 
      m.status === 'FIN' && 
      oldStatusMap.get(m.id) !== 'FIN' && 
      m.score_home !== null && 
      m.score_away !== null
    )

    let guessesUpdated = 0
    let calcTimeMs = 0

    if (newlyFinishedMatches.length > 0) {
      const startCalc = performance.now()
      const finishedIds = newlyFinishedMatches.map(m => m.id)
      
      const { data: guesses } = await supabaseAdmin
        .from('guesses')
        .select('*')
        .in('match_id', finishedIds)
        
      if (guesses && guesses.length > 0) {
        const guessesToUpsert = guesses.map(g => {
          const match = newlyFinishedMatches.find(m => m.id === g.match_id)
          if (!match) return g
          const points = calculateScore(g.score_home, g.score_away, match.score_home, match.score_away)
          return { ...g, points }
        })

        const { error: guessErr } = await supabaseAdmin
          .from('guesses')
          .upsert(guessesToUpsert, { onConflict: 'id' })

        if (guessErr) {
          console.error('Erro ao atualizar guesses:', guessErr)
        } else {
          guessesUpdated = guessesToUpsert.length
        }
      }
      calcTimeMs = Math.round(performance.now() - startCalc)
    }

    return NextResponse.json({ 
      success: true, 
      matchesUpserted: upsertData.length,
      guessesUpdated,
      calcTimeMs
    })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
