import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const errorMessages: Record<string, string> = {
  invalid: 'Código de convite inválido ou expirado.',
  full: 'Este bolão já atingiu o limite de participantes.',
  error: 'Ocorreu um erro ao tentar entrar no bolão. Tente novamente.',
}

export default async function JoinByLink({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { code } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/api/pending-invite?code=${encodeURIComponent(code)}`)
  }

  // Se há erro na query string, exibir mensagem amigável
  if (error) {
    return (
      <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-[#ff3d57] text-2xl font-bold">Ops!</div>
          <p className="text-[#8b94a8] text-sm">
            {errorMessages[error] ?? 'Erro desconhecido.'}
          </p>
          <Link href="/" className="text-xs text-[#5d6678] hover:text-white underline">
            ← Voltar ao início
          </Link>
        </div>
      </div>
    )
  }

  // Busca o grupo pelo código
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, player_limit')
    .eq('invite_code', code.toUpperCase())
    .single()

  if (groupError || !group) {
    redirect(`/join/${code}?error=invalid`)
  }

  // Verifica limite de jogadores
  const { count } = await supabase
    .from('group_members')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', group.id)

  if (count !== null && count >= group.player_limit) {
    redirect(`/join/${code}?error=full`)
  }

  // Verifica se já é membro — se sim, só redireciona
  const { data: existing } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    redirect(`/groups/${group.id}`)
  }

  // Adiciona como membro
  const { error: joinError } = await supabase
    .from('group_members')
    .insert({ group_id: group.id, user_id: user.id, role: 'member' })

  if (joinError) {
    redirect(`/join/${code}?error=error`)
  }

  redirect(`/groups/${group.id}`)
}
