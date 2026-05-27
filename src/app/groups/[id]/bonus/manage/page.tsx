import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createBonusQuestion, setBonusCorrectAnswer } from '../actions'

export default async function ManageBonusPage({ 
  params
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Puxa os dados do Grupo para verificar se é owner
  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', id)
    .single()

  if (!group || group.owner_id !== user.id) {
    return <div className="p-10 text-white font-mono">Apenas o administrador do grupo pode acessar esta página.</div>
  }

  // Puxa as perguntas existentes
  const { data: questions } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('group_id', group.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6">
      <Link href={`/groups/${group.id}/bonus`} className="text-xs text-[#5d6678] hover:text-white mb-4 inline-block">
        ← VOLTAR PARA BÔNUS
      </Link>
      
      <header className="mb-8 border-b border-[#1f242e] pb-4">
        <h1 className="font-bold text-2xl tracking-tight text-white uppercase">Gerenciar Bônus</h1>
        <p className="text-xs text-[#5d6678] mt-1">Crie perguntas valendo pontos extras ou defina as respostas corretas das perguntas encerradas.</p>
      </header>

      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Coluna 1: Criar nova pergunta */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider border-b border-[#1f242e] pb-2">Nova Pergunta</h2>
          
          <form action={createBonusQuestion as unknown as (formData: FormData) => void} className="bg-[#12151b] border border-[#2a3140] p-6 rounded-2xl flex flex-col gap-4">
            <input type="hidden" name="groupId" value={group.id} />
            
            <div>
              <label className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Pergunta</label>
              <input 
                type="text" 
                name="question" 
                required
                placeholder="Ex: Quem será o campeão da Copa?"
                className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-3 py-2 text-white text-sm focus:border-[#a13de3] focus:outline-none" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Tipo</label>
                <select 
                  name="questionType" 
                  required
                  className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-3 py-2 text-white text-sm focus:border-[#a13de3] focus:outline-none"
                >
                  <option value="text">Texto Livre</option>
                  <option value="options">Múltipla Escolha</option>
                  <option value="range">Número</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Pontos</label>
                <input 
                  type="number" 
                  name="points" 
                  defaultValue={10}
                  required
                  className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-3 py-2 text-white text-sm focus:border-[#a13de3] focus:outline-none" 
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">
                Opções (Apenas para Múltipla Escolha)
              </label>
              <input 
                type="text" 
                name="options" 
                placeholder='Ex: ["Brasil", "França", "Argentina"]'
                className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-3 py-2 text-white text-sm focus:border-[#a13de3] focus:outline-none font-mono text-[10px]" 
              />
              <p className="text-[9px] text-[#5d6678] mt-1">Insira um array JSON válido ou deixe em branco para texto livre/número.</p>
            </div>

            <div>
              <label className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Data/Hora Limite</label>
              <input 
                type="datetime-local" 
                name="deadline" 
                required
                className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-3 py-2 text-white text-sm focus:border-[#a13de3] focus:outline-none" 
              />
            </div>

            <button 
              type="submit" 
              className="mt-2 text-xs font-bold tracking-widest text-white bg-[#a13de3] px-4 py-3 rounded hover:bg-[#8b2ec4] transition"
            >
              CRIAR PERGUNTA
            </button>
          </form>
        </div>

        {/* Coluna 2: Perguntas Existentes */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider border-b border-[#1f242e] pb-2">Perguntas Cadastradas</h2>
          
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            {questions && questions.length > 0 ? (
              questions.map((q: any) => {
                const deadline = new Date(q.deadline)
                const isExpired = deadline < new Date()

                return (
                  <div key={q.id} className="bg-[#12151b] border border-[#2a3140] p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-white text-sm">{q.question}</h3>
                      <span className="text-[10px] font-bold text-[#a13de3] bg-[#a13de3]/10 px-2 py-0.5 rounded">{q.points} pts</span>
                    </div>
                    
                    <div className="text-[10px] text-[#5d6678] flex justify-between">
                      <span>Tipo: {q.question_type}</span>
                      <span className={isExpired ? 'text-[#ff3d57]' : 'text-[#00d68f]'}>
                        {isExpired ? 'Encerrado' : 'Aberto até'} {deadline.toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Formulário para definir resposta correta (apenas se expirado) */}
                    {isExpired && (
                      <div className="mt-2 pt-3 border-t border-[#1f242e]">
                        <form action={setBonusCorrectAnswer as unknown as (formData: FormData) => void} className="flex gap-2">
                          <input type="hidden" name="questionId" value={q.id} />
                          <input type="hidden" name="groupId" value={group.id} />
                          <input 
                            type="text" 
                            name="correctAnswer" 
                            defaultValue={q.correct_answer || ''}
                            placeholder="Gabarito oficial..."
                            required
                            className="flex-1 bg-[#08090b] border border-[#2a3140] rounded px-2 py-1 text-white text-xs focus:border-[#00d68f] focus:outline-none"
                          />
                          <button 
                            type="submit"
                            className="bg-[#00d68f]/20 hover:bg-[#00d68f] text-[#00d68f] hover:text-black text-[10px] font-bold px-3 rounded transition"
                          >
                            SALVAR
                          </button>
                        </form>
                        <p className="text-[9px] text-[#5d6678] mt-1 italic">
                          Atenção: Ao salvar, o sistema atualizará a pontuação de todos que acertaram (texto exato, ignorando maiúsculas).
                        </p>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-xs text-[#5d6678] italic">Nenhuma pergunta criada.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
