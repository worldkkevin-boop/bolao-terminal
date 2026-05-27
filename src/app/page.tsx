import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Buscar os grupos em que o usuário está
  const { data: myMemberships } = await supabase
    .from('group_members')
    .select('groups ( id, name, invite_code )')
    .eq('user_id', user.id)

  const myGroups = myMemberships?.map((m: any) => m.groups).filter(Boolean) || []

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6">
      <header className="flex justify-between items-center mb-8 border-b border-[#1f242e] pb-4">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">
            BOLÃO<span className="text-[#00d68f]">.</span>TERMINAL
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#8b94a8]">Olá, {user.user_metadata.full_name || user.email}</span>
          {user.email === 'kevinsantos.b.f@gmail.com' && (
            <Link href="/super-admin/hedge" className="text-xs bg-[#00d68f] text-black font-bold px-3 py-1.5 rounded hover:bg-white transition flex items-center gap-1">
              <span>⚙️</span> ADMIN
            </Link>
          )}
          <form action="/auth/signout" method="post">
            <button className="text-xs border border-[#2a3140] px-3 py-1.5 hover:border-[#ff3d57] hover:text-[#ff3d57] transition">
              Sair
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        
        {/* Grupos Section */}
        <section>
          <div className="text-[10px] tracking-[0.3em] text-[#5d6678] mb-2">AÇÕES</div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            
            {/* Create Group Card */}
            <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded hover:border-[#00c2ff] transition flex flex-col items-start justify-center">
              <h3 className="text-lg font-bold mb-2">Criar um novo Grupo</h3>
              <p className="text-xs text-[#8b94a8] mb-4">Crie seu próprio bolão, convide amigos e administre as regras.</p>
              <Link href="/groups/new" className="text-xs bg-[#00c2ff] text-black font-bold px-4 py-2 rounded">
                + CRIAR GRUPO
              </Link>
            </div>

            {/* Join Group Card */}
            <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded hover:border-[#ffb547] transition flex flex-col items-start justify-center">
              <h3 className="text-lg font-bold mb-2">Entrar com Código</h3>
              <p className="text-xs text-[#8b94a8] mb-4">Recebeu um código de convite de um amigo? Entre no bolão dele.</p>
              <form action="/groups/join" method="post" className="flex w-full gap-2">
                <input 
                  name="code"
                  type="text" 
                  placeholder="EX: COPA-X7K9" 
                  className="bg-[#08090b] border border-[#2a3140] px-3 py-2 text-sm w-full focus:outline-none focus:border-[#ffb547]"
                  required
                />
                <button type="submit" className="text-xs bg-[#ffb547] text-black font-bold px-4 py-2 rounded">
                  ENTRAR
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Meus Grupos Section */}
        <section>
          <div className="text-[10px] tracking-[0.3em] text-[#5d6678] mb-2">MEUS BOLÕES</div>
          
          {myGroups.length === 0 ? (
            <div className="bg-[#12151b] border border-[#2a3140] p-6 rounded text-center text-[#8b94a8] text-sm">
              Você ainda não está em nenhum grupo. Crie um ou entre usando um código acima!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {myGroups.map((g: any) => (
                <Link key={g.id} href={`/groups/${g.id}`} className="bg-[#12151b] border border-[#2a3140] p-4 rounded hover:border-[#e6eaf2] transition flex justify-between items-center group">
                  <div>
                    <h3 className="font-bold text-[#e6eaf2] group-hover:text-[#00c2ff] transition">{g.name}</h3>
                    <p className="text-xs text-[#5d6678]">Código: {g.invite_code}</p>
                  </div>
                  <div className="text-[#00c2ff]">
                    ➔
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
