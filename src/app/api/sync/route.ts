import { NextResponse } from 'next/server'
// Importamos uma lib do supabase que bypassa RLS para uso em backend
import { createClient } from '@supabase/supabase-js'

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

    // 3. Salva no banco de dados
    if (upsertData.length > 0) {
      const { error } = await supabaseAdmin
        .from('matches')
        .upsert(upsertData, { onConflict: 'id' })

      if (error) {
        console.error('Erro ao fazer upsert:', error)
        return NextResponse.json({ error: 'Falha ao gravar no Supabase' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, count: upsertData.length })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
