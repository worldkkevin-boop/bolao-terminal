'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function createGroup(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name') as string
  if (!name || name.trim() === '') return

  // Gera um código de convite de 6 caracteres (letras maiúsculas e números)
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  // 1. Cria o grupo
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      invite_code: inviteCode,
      owner_id: user.id,
      player_limit: 5 // Grátis começa com 5
    })
    .select()
    .single()

  if (groupError || !group) {
    console.error('Erro ao criar grupo', groupError)
    throw new Error('Falha ao criar o grupo')
  }

  // 2. Adiciona o dono como membro do grupo
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: user.id,
      role: 'owner'
    })

  if (memberError) {
    console.error('Erro ao adicionar membro', memberError)
    throw new Error('Falha ao adicionar o dono como membro')
  }

  // Redireciona para o dashboard do novo grupo
  redirect(`/groups/${group.id}`)
}
