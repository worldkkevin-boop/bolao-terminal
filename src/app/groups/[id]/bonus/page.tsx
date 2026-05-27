import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { saveBonusAnswer } from './actions'

export default async function BonusPage({ 
  params
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Puxa os dados do Grupo
  const { data: group } = await supabase
    .from('groups')
    .select('*, group_members!inner(user_id, role)')
    .eq('id', id)
    .single()

  const isMember = group?.group_members.some((m: any) => m.user_id === user.id)
  if (!group || !isMember) {
    return <div className="p-10 text-white font-mono">Você não tem acesso a este grupo.</div>
  }

  const currentUserRole = group.group_members.find((m: any) => m.user_id === user.id)?.role

  // Puxa as perguntas bônus
  const { data: questions } = await supabase
    .from('bonus_questions')
    .select('*')
    .eq('group_id', group.id)
    .order('deadline', { ascending: true })

  // Puxa as respostas do usuário atual
  const { data: userAnswers } = await supabase
    .from('bonus_answers')
    .select('*')
    .eq('user_id', user.id)
    .in('question_id', questions?.map((q: any) => q.id) || [])

  const answersMap = new Map(userAnswers?.map((a: any) => [a.question_id, a]) || [])

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-4 md:p-6">
      <Link href="/" className="text-xs text-[#5d6678] hover:text-white mb-4 inline-block">
        ← VOLTAR AO INÍCIO
      </Link>
      
      <header className="flex flex-col md:flex-row justify-between md:items-end mb-8 border-b border-[#1f242e] pb-4 gap-4">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-[#00c2ff]">BOLÃO:</div>
          <h1 className="font-bold text-3xl tracking-tight text-white uppercase">{group.name}</h1>
        </div>
      </header>

      {/* Menu de Abas */}
      <div className="flex gap-6 border-b border-[#1f242e] mb-8 overflow-x-auto no-scrollbar">
        <Link 
          href={`/groups/${group.id}?tab=matches`} 
          className="pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap text-[#5d6678] hover:text-[#e6eaf2] transition"
        >
          Partidas
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=ranking`} 
          className="pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap text-[#5d6678] hover:text-[#e6eaf2] transition"
        >
          Ranking
        </Link>
        <Link 
          href={`/groups/${group.id}/bonus`} 
          className="pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap text-[#a13de3] border-b-2 border-[#a13de3]"
        >
          Bônus
        </Link>
        <Link 
          href={`/groups/${group.id}?tab=settings`} 
          className="pb-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap text-[#5d6678] hover:text-[#e6eaf2] transition"
        >
          Configurações
        </Link>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-white uppercase tracking-wider">Perguntas Bônus</h2>
          {currentUserRole === 'owner' && (
            <Link 
              href={`/groups/${group.id}/bonus/manage`}
              className="text-xs bg-[#2a3140] hover:bg-[#5d6678] text-white px-4 py-2 rounded font-bold transition"
            >
              GERENCIAR PERGUNTAS
            </Link>
          )}
        </div>

        {questions && questions.length > 0 ? (
          <div className="space-y-4">
            {questions.map((question: any) => {
              const answer = answersMap.get(question.id)
              const deadline = new Date(question.deadline)
              const isExpired = deadline < new Date()
              const hasAnswered = !!answer

              return (
                <div key={question.id} className="bg-[#12151b] border border-[#2a3140] p-6 rounded-2xl flex flex-col gap-4 shadow-sm">
                  <div className="flex justify-between items-start border-b border-[#1f242e] pb-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] tracking-widest text-[#a13de3] uppercase font-bold mb-1">Valendo {question.points} pontos</span>
                      <h3 className="font-bold text-white text-lg">{question.question}</h3>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] tracking-widest text-[#5d6678] uppercase mb-1">Prazo</span>
                      <span className={`text-xs font-bold ${isExpired ? 'text-[#ff3d57]' : 'text-[#00d68f]'}`}>
                        {deadline.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                      </span>
                    </div>
                  </div>

                  {!isExpired ? (
                    <form action={saveBonusAnswer as unknown as (formData: FormData) => void} className="flex flex-col gap-3 mt-2">
                      <input type="hidden" name="questionId" value={question.id} />
                      <input type="hidden" name="groupId" value={group.id} />
                      
                      {question.question_type === 'text' && (
                        <input 
                          type="text" 
                          name="answer" 
                          defaultValue={answer?.answer || ''}
                          className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-4 py-3 text-white text-sm focus:border-[#a13de3] focus:outline-none" 
                          placeholder="Sua resposta..."
                          required
                        />
                      )}

                      {question.question_type === 'options' && question.options && (
                        <select 
                          name="answer" 
                          defaultValue={answer?.answer || ''}
                          className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-4 py-3 text-white text-sm focus:border-[#a13de3] focus:outline-none"
                          required
                        >
                          <option value="" disabled>Selecione uma opção...</option>
                          {question.options.map((opt: string, i: number) => (
                            <option key={i} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {question.question_type === 'range' && (
                        <input 
                          type="number" 
                          name="answer" 
                          defaultValue={answer?.answer || ''}
                          className="w-full bg-[#08090b] border border-[#2a3140] rounded-md px-4 py-3 text-white text-sm focus:border-[#a13de3] focus:outline-none" 
                          placeholder="Digite o número..."
                          required
                        />
                      )}

                      <div className="flex justify-end mt-2">
                        <button 
                          type="submit" 
                          className="text-[10px] font-bold tracking-widest text-white bg-[#a13de3] px-6 py-2 rounded hover:bg-[#8b2ec4] transition"
                        >
                          {hasAnswered ? 'ATUALIZAR RESPOSTA' : 'SALVAR RESPOSTA'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="bg-[#08090b] rounded-xl p-4 border border-[#1f242e] flex flex-col gap-3 mt-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Você respondeu:</span>
                          <span className="font-bold text-[#e6eaf2] text-sm">
                            {hasAnswered ? answer.answer : <span className="text-[#5d6678] italic">Não respondeu</span>}
                          </span>
                        </div>
                        {hasAnswered && (
                          <div className={`text-xs font-bold px-3 py-1 rounded-full border ${
                            answer.points_earned > 0 
                              ? 'text-[#00d68f] border-[#00d68f]/30 bg-[#00d68f]/10' 
                              : question.correct_answer 
                                ? 'text-[#ff3d57] border-[#ff3d57]/30 bg-[#ff3d57]/10'
                                : 'text-[#5d6678] border-[#2a3140]'
                          }`}>
                            {question.correct_answer ? `+${answer.points_earned} pts` : 'Aguardando apuração'}
                          </div>
                        )}
                      </div>
                      
                      {question.correct_answer && (
                        <div className="pt-3 border-t border-[#1f242e]">
                          <span className="text-[10px] tracking-widest text-[#5d6678] uppercase block mb-1">Resposta Correta:</span>
                          <span className="font-bold text-[#00d68f] text-sm">{question.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center text-[#5d6678] py-10 border border-dashed border-[#2a3140] rounded-xl">
            O administrador ainda não criou perguntas bônus para este bolão.
          </div>
        )}
      </div>
    </div>
  )
}
