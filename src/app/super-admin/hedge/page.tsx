import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { syncMatchesToDB } from './actions'
import PoissonMatrix from '@/components/hedge/PoissonMatrix'

export default async function SuperAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== 'worldkkevin@gmail.com') {
    redirect('/')
  }

  // Buscar Métricas do Banco
  const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: groupsCount } = await supabase.from('groups').select('*', { count: 'exact', head: true })
  const { count: matchesCount } = await supabase.from('matches').select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6">
      <header className="flex justify-between items-end mb-8 border-b border-[#1f242e] pb-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#00d68f]">ACESSO RESTRITO</div>
          <h1 className="font-bold text-3xl tracking-tight text-white uppercase">
            HEDGE<span className="text-[#00d68f]">.</span>ENGINE
          </h1>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="text-xs text-[#5d6678] hover:text-white transition py-2">
            ← VOLTAR AO INÍCIO
          </Link>
        </div>
      </header>

      {/* MÉTRICAS SAAS */}
      <section className="mb-10">
        <div className="text-[10px] tracking-[0.3em] text-[#5d6678] mb-4">SaaS METRICS</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00c2ff]"></div>
            <div className="text-[10px] tracking-widest text-[#5d6678] uppercase mb-1">Usuários Registrados</div>
            <div className="text-4xl font-bold text-white">{usersCount ?? 0}</div>
          </div>

          <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#ffb547]"></div>
            <div className="text-[10px] tracking-widest text-[#5d6678] uppercase mb-1">Bolões Ativos</div>
            <div className="text-4xl font-bold text-white">{groupsCount ?? 0}</div>
          </div>

          <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#00d68f]"></div>
            <div className="text-[10px] tracking-widest text-[#5d6678] uppercase mb-1">Jogos no Banco</div>
            <div className="text-4xl font-bold text-white">{matchesCount ?? 0}</div>
          </div>

        </div>
      </section>

      {/* CONTROLE DO BANCO */}
      <section className="mb-10">
        <div className="text-[10px] tracking-[0.3em] text-[#5d6678] mb-4">CONTROLE DE DADOS</div>
        
        <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h3 className="font-bold text-[#e6eaf2] text-lg mb-1">Sincronização de Partidas</h3>
            <p className="text-xs text-[#8b94a8]">Conecte-se com a API-Sports e injete novos jogos na tabela global de "matches". Isso afetará todos os bolões.</p>
          </div>
          <form action={syncMatchesToDB as unknown as (formData: FormData) => void}>
            <button className="bg-[#00c2ff] text-black text-xs font-bold px-6 py-3 rounded-lg hover:bg-white transition whitespace-nowrap">
              ↻ SINCRONIZAR API-SPORTS
            </button>
          </form>
        </div>
      </section>

      {/* ÁREA MATEMÁTICA (POISSON / HEDGE) */}
      <section>
        <div className="text-[10px] tracking-[0.3em] text-[#8b5cf6] mb-4">HEDGE ENGINE (PREVISÃO ESTATÍSTICA)</div>
        <PoissonMatrix />
      </section>

    </div>
  )
}
