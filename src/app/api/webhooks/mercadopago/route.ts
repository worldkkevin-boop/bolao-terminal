import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const url = new URL(request.url)
  const topic = url.searchParams.get('topic')
  const id = url.searchParams.get('id')

  if (topic === 'payment' && id) {
    try {
      const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
      const payment = new Payment(client)
      
      const paymentData = await payment.get({ id: id })

      if (paymentData.status === 'approved') {
        const external_reference = paymentData.external_reference
        if (external_reference) {
          // Extrai o groupId e o novo limit que definimos no /api/payments/pix
          const [groupId, newLimitStr] = external_reference.split('|')
          const newLimit = parseInt(newLimitStr)

          // Atualiza o banco de dados via Service Role
          if (groupId && newLimit) {
            await supabaseAdmin
              .from('groups')
              .update({ player_limit: newLimit })
              .eq('id', groupId)

            console.log(`[PIX] Pagamento aprovado! Limite do grupo ${groupId} aumentado para ${newLimit}.`)
          }
        }
      }
      return NextResponse.json({ received: true })
    } catch (error) {
      console.error('Erro no webhook:', error)
      return NextResponse.json({ error: 'Falha no webhook' }, { status: 500 })
    }
  }

  return NextResponse.json({ ignored: true })
}
