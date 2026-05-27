'use client'

import { useState } from 'react'
import Link from 'next/link'

import { use } from 'react'

export default function UpgradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params)
  const [loading, setLoading] = useState(false)
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_base64: string } | null>(null)
  const [error, setError] = useState('')

  const handleBuy = async (packageId: string) => {
    setLoading(true)
    setError('')
    setPixData(null)

    try {
      const res = await fetch('/api/payments/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, packageId })
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setPixData(data)
      }
    } catch (err) {
      setError('Falha ao processar o pagamento')
    } finally {
      setLoading(false)
    }
  }

  const copyPix = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code)
      alert('Código PIX Copia e Cola copiado com sucesso!')
    }
  }

  return (
    <div className="min-h-screen bg-[#08090b] text-[#e6eaf2] font-mono p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl">
        <Link href={`/groups/${groupId}`} className="text-xs text-[#5d6678] hover:text-white mb-6 inline-block">
          ← VOLTAR PARA O GRUPO
        </Link>
        
        <h1 className="text-3xl font-bold mb-2">Aumentar Limite de Jogadores</h1>
        <p className="text-[#8b94a8] mb-8 text-sm">Seu grupo grátis comporta até 5 participantes. Escolha um plano abaixo para liberar mais vagas instantaneamente via PIX.</p>

        {error && <div className="bg-[#ff3d57]/20 border border-[#ff3d57] text-[#ff3d57] p-4 mb-6 rounded">{error}</div>}

        {!pixData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* PLANO PLUS */}
            <div className="bg-[#12151b] border border-[#2a3140] p-6 flex flex-col hover:border-[#00c2ff] transition">
              <h3 className="text-[#00c2ff] font-bold text-lg mb-1">PLANO PLUS</h3>
              <div className="text-xs text-[#5d6678] mb-4">Até 10 Jogadores</div>
              <div className="text-2xl font-bold mb-6">R$ 15,00</div>
              <button 
                onClick={() => handleBuy('plus_10')}
                disabled={loading}
                className="mt-auto bg-[#00c2ff] text-black font-bold py-2 hover:bg-[#00a3d9] disabled:opacity-50"
              >
                {loading ? 'GERANDO...' : 'COMPRAR'}
              </button>
            </div>

            {/* PLANO PRO */}
            <div className="bg-[#12151b] border border-[#ffb547] p-6 flex flex-col relative transform md:-translate-y-2 shadow-[0_0_15px_rgba(255,181,71,0.2)]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ffb547] text-black text-[10px] font-bold px-3 py-1">MAIS POPULAR</div>
              <h3 className="text-[#ffb547] font-bold text-lg mb-1">PLANO PRO</h3>
              <div className="text-xs text-[#5d6678] mb-4">Até 20 Jogadores</div>
              <div className="text-2xl font-bold mb-6">R$ 25,00</div>
              <button 
                onClick={() => handleBuy('pro_20')}
                disabled={loading}
                className="mt-auto bg-[#ffb547] text-black font-bold py-2 hover:bg-[#e5a23c] disabled:opacity-50"
              >
                {loading ? 'GERANDO...' : 'COMPRAR'}
              </button>
            </div>

            {/* PLANO VIP */}
            <div className="bg-[#12151b] border border-[#2a3140] p-6 flex flex-col hover:border-[#00d68f] transition">
              <h3 className="text-[#00d68f] font-bold text-lg mb-1">PLANO VIP</h3>
              <div className="text-xs text-[#5d6678] mb-4">Até 50 Jogadores</div>
              <div className="text-2xl font-bold mb-6">R$ 45,00</div>
              <button 
                onClick={() => handleBuy('vip_50')}
                disabled={loading}
                className="mt-auto bg-[#00d68f] text-black font-bold py-2 hover:bg-[#00b879] disabled:opacity-50"
              >
                {loading ? 'GERANDO...' : 'COMPRAR'}
              </button>
            </div>

          </div>
        ) : (
          <div className="bg-[#12151b] border border-[#00d68f] p-8 flex flex-col items-center text-center">
            <h3 className="text-[#00d68f] font-bold text-2xl mb-2">PIX GERADO!</h3>
            <p className="text-[#8b94a8] mb-6 text-sm">Escaneie o QR Code abaixo no app do seu banco. A liberação do limite será automática em poucos segundos.</p>
            
            <img 
              src={`data:image/png;base64,${pixData.qr_code_base64}`} 
              alt="QR Code PIX" 
              className="w-48 h-48 border-4 border-white mb-6"
            />

            <button 
              onClick={copyPix}
              className="bg-[#2a3140] text-white px-6 py-3 font-bold hover:bg-[#3a4358] transition flex items-center gap-2"
            >
              COPIAR CÓDIGO PIX ("COPIA E COLA")
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
