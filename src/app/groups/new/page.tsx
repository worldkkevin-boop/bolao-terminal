import { createGroup } from './actions'
import Link from 'next/link'

export default function NewGroupPage() {
  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-md bg-[#12151b] border border-[#2a3140] p-8 rounded shadow-2xl relative">
        <Link href="/" className="absolute top-4 left-4 text-xs text-[#5d6678] hover:text-white">
          ← VOLTAR
        </Link>

        <h1 className="text-2xl font-bold mt-6 mb-2">Criar Novo Bolão</h1>
        <p className="text-xs text-[#8b94a8] mb-6">
          Você será o administrador deste grupo. Na versão gratuita, você pode convidar até 4 amigos (5 jogadores no total).
        </p>

        <form action={createGroup} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-xs font-bold text-[#5d6678] mb-1">
              NOME DO GRUPO
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="Ex: Bolão da Firma"
              className="w-full bg-[#08090b] border border-[#2a3140] px-4 py-3 text-sm focus:outline-none focus:border-[#00c2ff] text-white"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#00c2ff] text-black font-bold py-3 mt-4 rounded hover:bg-[#00a3d9] transition"
          >
            CRIAR GRUPO
          </button>
        </form>
      </div>
    </div>
  )
}
