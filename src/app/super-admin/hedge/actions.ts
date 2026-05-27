'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Exemplo: Buscar da API Externa e salvar no banco
export async function syncMatchesToDB() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'worldkkevin@gmail.com') return { error: 'Não autorizado' }

  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
    const syncSecret = process.env.SYNC_SECRET || ''
    
    const res = await fetch(`${siteUrl}/api/sync?secret=${syncSecret}`, { cache: 'no-store' })
    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.error || 'Erro desconhecido na sincronização')
    }

    revalidatePath('/super-admin/hedge')
    return { success: true, count: data.count }
  } catch (err: any) {
    return { error: err.message }
  }
}
