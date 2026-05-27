import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { SCORING_LABELS, ScoreCategory, DEFAULT_SCORING_RULES } from '@/utils/scoring'
import { updateScoringRules } from './actions'

const EDITABLE_CATEGORIES: ScoreCategory[] = [
  'EXATO',
  'VENCEDOR_GOLS',
  'VENCEDOR_SALDO',
  'EMPATE',
  'VENCEDOR_GOLS_PERDEDOR',
  'VENCEDOR',
  'GOLS_PARCIAL',
]

export default async function ScoringAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== 'worldkkevin@gmail.com') redirect('/')

  const rules = DEFAULT_SCORING_RULES

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6">
      <Link href="/super-admin/hedge" className="text-xs text-[#5d6678] hover:text-white mb-6 inline-block">
        ← VOLTAR AO ADMIN
      </Link>

      <div className="mb-8">
        <div className="text-[10px] tracking-[0.3em] text-[#00c2ff] mb-1">SUPER ADMIN</div>
        <h1 className="text-2xl font-bold text-white uppercase">Regras de Pontuação</h1>
        <p className="text-xs text-[#5d6678] mt-1">Alterações aplicam imediatamente para todos os bolões.</p>
      </div>

      <form action={updateScoringRules as unknown as (formData: FormData) => void} className="max-w-lg space-y-3">
        {EDITABLE_CATEGORIES.map(category => {
          const meta = SCORING_LABELS[category]
          return (
            <div
              key={category}
              className="bg-[#12151b] border border-[#2a3140] rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}
            >
              <div className="min-w-0">
                <div className="text-sm font-bold" style={{ color: meta.color }}>{meta.label}</div>
                <div className="text-xs text-[#5d6678] mt-0.5">{meta.desc}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="number"
                  name={category}
                  defaultValue={rules[category]}
                  min={0}
                  max={100}
                  className="w-16 bg-[#08090b] border border-[#2a3140] rounded text-center text-white font-bold text-sm py-1.5 focus:border-[#00c2ff] focus:outline-none"
                />
                <span className="text-xs text-[#5d6678]">pts</span>
              </div>
            </div>
          )
        })}

        <button
          type="submit"
          className="w-full bg-[#00c2ff] text-black font-bold text-sm py-3 rounded-xl hover:bg-white transition mt-2"
        >
          SALVAR ALTERAÇÕES
        </button>
      </form>
    </div>
  )
}
