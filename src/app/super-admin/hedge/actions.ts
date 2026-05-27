'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Exemplo: Buscar da API Externa e salvar no banco
export async function syncMatchesToDB() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'worldkkevin@gmail.com') return { error: 'Não autorizado' }

  try {
    // Isso é um MOCK por enquanto.
    // O próximo passo será conectar isso à API-Sports como o HTML antigo fazia!
    
    // Deleta os jogos antigos (Apenas para debug)
    // await supabase.from('matches').delete().neq('id', '0')

    revalidatePath('/super-admin/hedge')
    return { success: true }
  } catch (err: any) {
    return { error: err.message }
  }
}
