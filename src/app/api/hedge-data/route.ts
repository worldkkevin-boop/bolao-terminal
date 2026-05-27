import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Pegar o grupo que esse usuário é dono (admin)
  const { data: group } = await supabase
    .from('groups')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (!group) return NextResponse.json({ error: 'Você não é dono de nenhum grupo' }, { status: 403 })

  // Pegar todos os membros e seus palpites
  const { data: members } = await supabase
    .from('group_members')
    .select(`
      user_id,
      profiles:user_id ( full_name )
    `)
    .eq('group_id', group.id)

  const { data: guesses } = await supabase
    .from('guesses')
    .select('*')
    .eq('group_id', group.id)

  return NextResponse.json({
    group,
    members: members?.map(m => ({
      id: m.user_id,
      name: (m.profiles as any)?.full_name || 'Usuário'
    })),
    guesses
  })
}
