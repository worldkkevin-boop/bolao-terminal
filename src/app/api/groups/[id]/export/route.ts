import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { calculateScore, calculateScoreDetailed } from '@/utils/scoring'
import PDFDocument from 'pdfkit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') || 'csv'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  // 1. Grupo + Membros
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, role, profiles(full_name, avatar_url))')
    .eq('id', id)
    .single()

  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  // 2. Matches FIN
  const { data: finishedMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'FIN')

  const matchesMap = new Map(finishedMatches?.map(m => [m.id, m]) || [])

  // 3. Guesses
  const { data: allGuesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('group_id', group.id)

  // 4. Bônus
  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('group_id', group.id)

  const { data: bonusAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .in('question_id', bonusQuestions?.map(q => q.id) || [])

  // 5. Agrupar dados
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

  // 6. Calcular ranking detalhado
  const rankings = group.group_members.map((member: any) => {
    let matchPoints = 0
    let exactCount = 0
    let winnerCount = 0
    const bonusPoints = bonusByUser.get(member.user_id) || 0

    const memberGuesses = guessesByUser.get(member.user_id) || []

    memberGuesses.forEach(guess => {
      const match = matchesMap.get(guess.match_id)
      if (match && match.score_home !== null && match.score_away !== null) {
        const details = calculateScoreDetailed(guess.score_home, guess.score_away, match.score_home, match.score_away)
        matchPoints += guess.points ?? details.points
        if (details.category === 'EXATO') exactCount++
        if (details.category !== 'ERROU' && details.category !== 'GOLS_PARCIAL') winnerCount++
      }
    })

    return {
      name: member.profiles.full_name || 'Sem Nome',
      matchPoints,
      bonusPoints,
      totalPoints: matchPoints + bonusPoints,
      exactCount,
      winnerCount
    }
  })

  rankings.sort((a: any, b: any) => b.totalPoints - a.totalPoints)

  const safeName = group.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  const dateStr = new Date().toISOString().slice(0, 10)

  // ========== CSV ==========
  if (format === 'csv') {
    const header = 'Posição,Nome,Pontos Totais,Pontos Partidas,Pontos Bônus,Placares Exatos,Acertos de Vencedor'
    const rows = rankings.map((r: any, i: number) =>
      `${i + 1},"${r.name}",${r.totalPoints},${r.matchPoints},${r.bonusPoints},${r.exactCount},${r.winnerCount}`
    )
    const csv = [header, ...rows].join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="bolao-${safeName}-${dateStr}.csv"`,
      },
    })
  }

  // ========== PDF ==========
  if (format === 'pdf') {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))

    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
    })

    // --- Cabeçalho ---
    doc.fontSize(22).fillColor('#000000').text(group.name, { align: 'center' })
    doc.moveDown(0.3)
    doc.fontSize(10).fillColor('#666666').text(`Código de Convite: ${group.invite_code}  •  Membros: ${group.group_members.length}  •  Data: ${dateStr}`, { align: 'center' })
    doc.moveDown(0.5)

    // Linha separadora
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke()
    doc.moveDown(0.8)

    // --- Cabeçalho da Tabela ---
    const cols = [
      { label: '#', x: 50, w: 30 },
      { label: 'Nome', x: 80, w: 180 },
      { label: 'Total', x: 260, w: 60 },
      { label: 'Partidas', x: 320, w: 60 },
      { label: 'Bônus', x: 380, w: 50 },
      { label: 'Exatos', x: 430, w: 50 },
      { label: 'Vencedor', x: 480, w: 65 },
    ]

    const headerY = doc.y
    doc.fontSize(9).fillColor('#333333').font('Helvetica-Bold')
    cols.forEach(col => {
      doc.text(col.label, col.x, headerY, { width: col.w, align: col.x === 80 ? 'left' : 'center' })
    })

    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#eeeeee').stroke()
    doc.moveDown(0.3)

    // --- Linhas de dados ---
    doc.font('Helvetica')
    rankings.forEach((r: any, i: number) => {
      const y = doc.y
      const rank = i + 1

      // Fundo alternado
      if (rank % 2 === 0) {
        doc.rect(48, y - 2, 499, 16).fillColor('#f8f8f8').fill()
      }

      // Destaque para top 3
      const textColor = rank <= 3 ? '#1a1a1a' : '#444444'
      doc.fillColor(textColor).fontSize(9)

      const bold = rank <= 3 ? 'Helvetica-Bold' : 'Helvetica'
      doc.font(bold)

      doc.text(`${rank}`, cols[0].x, y, { width: cols[0].w, align: 'center' })
      doc.text(r.name, cols[1].x, y, { width: cols[1].w, align: 'left' })
      doc.text(`${r.totalPoints}`, cols[2].x, y, { width: cols[2].w, align: 'center' })
      doc.text(`${r.matchPoints}`, cols[3].x, y, { width: cols[3].w, align: 'center' })
      doc.text(`${r.bonusPoints}`, cols[4].x, y, { width: cols[4].w, align: 'center' })
      doc.text(`${r.exactCount}`, cols[5].x, y, { width: cols[5].w, align: 'center' })
      doc.text(`${r.winnerCount}`, cols[6].x, y, { width: cols[6].w, align: 'center' })

      doc.font('Helvetica')
      doc.moveDown(0.3)

      // Pula página se necessário
      if (doc.y > 750) {
        doc.addPage()
        doc.y = 50
      }
    })

    // Rodapé
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#cccccc').stroke()
    doc.moveDown(0.5)
    doc.fontSize(8).fillColor('#999999').text(`Gerado automaticamente pelo Bolão do Ladaya em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' })

    doc.end()

    const pdfBuffer = await pdfPromise

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="bolao-${safeName}-${dateStr}.pdf"`,
      },
    })
  }

  return NextResponse.json({ error: 'Formato inválido. Use ?format=csv ou ?format=pdf' }, { status: 400 })
}
