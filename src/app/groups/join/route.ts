import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const formData = await request.formData()
  const code = formData.get('code') as string

  if (!code || code.trim() === '') {
    return NextResponse.redirect(new URL('/?error=codigo_invalido', request.url))
  }

  // 1. Busca o grupo pelo código de convite
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, player_limit')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (groupError || !group) {
    return NextResponse.redirect(new URL('/?error=grupo_nao_encontrado', request.url))
  }

  // 2. Verifica limite de jogadores
  const { count } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id)

  if (count !== null && count >= group.player_limit) {
    return NextResponse.redirect(new URL('/?error=grupo_cheio', request.url))
  }

  // 3. Verifica se já é membro
  const { data: existingMember } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single()

  if (existingMember) {
    return NextResponse.redirect(new URL(`/groups/${group.id}`, request.url))
  }

  // 4. Adiciona como membro
  const { error: joinError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'member'
    })

  if (joinError) {
    return NextResponse.redirect(new URL('/?error=erro_ao_entrar', request.url))
  }

  return NextResponse.redirect(new URL(`/groups/${group.id}`, request.url))
}
