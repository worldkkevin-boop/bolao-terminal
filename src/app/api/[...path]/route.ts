import { NextResponse } from 'next/server'

const API_BASE = 'https://v3.football.api-sports.io'
const ALLOWED_ENDPOINTS = [
  'fixtures', 'fixtures/headtohead', 'fixtures/statistics', 'fixtures/lineups',
  'fixtures/events', 'predictions', 'odds', 'odds/live', 'odds/bookmakers',
  'teams', 'teams/statistics', 'standings', 'injuries', 'players/topscorers',
  'players/topassists', 'status'
]

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  
  const API_KEY = process.env.API_SPORTS_KEY
  if (!API_KEY) {
    return NextResponse.json({ error: 'API_SPORTS_KEY não configurada' }, { status: 500 })
  }

  const pathname = path.join('/')
  
  if (!ALLOWED_ENDPOINTS.includes(pathname)) {
    return NextResponse.json({ error: `Endpoint não permitido: "${pathname}"` }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const queryString = searchParams.toString()
  const targetURL = `${API_BASE}/${pathname}${queryString ? '?' + queryString : ''}`

  try {
    const apiRes = await fetch(targetURL, {
      headers: { 'x-apisports-key': API_KEY },
      next: { revalidate: 300 } // Cache nativo do Next.js
    })

    if (!apiRes.ok) {
      return NextResponse.json({ error: `API-Football retornou HTTP ${apiRes.status}` }, { status: apiRes.status })
    }

    const data = await apiRes.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: 'Falha ao conectar com API-Football', details: err.message }, { status: 502 })
  }
}
