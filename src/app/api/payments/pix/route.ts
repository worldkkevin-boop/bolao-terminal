import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { groupId, packageId } = await request.json()

  // Preços e Limites
  const packages = {
    'plus_10': { amount: 15.00, limit: 10, description: 'Plano Plus (10 Jogadores)' },
    'pro_20': { amount: 25.00, limit: 20, description: 'Plano Pro (20 Jogadores)' },
    'vip_50': { amount: 45.00, limit: 50, description: 'Plano VIP (50 Jogadores)' }
  }

  const selectedPkg = packages[packageId as keyof typeof packages]
  if (!selectedPkg) return NextResponse.json({ error: 'Pacote inválido' }, { status: 400 })

  // Verifica se o usuário é o dono do grupo
  const { data: group } = await supabase
    .from('groups')
    .select('id, owner_id')
    .eq('id', groupId)
    .single()

  if (!group || group.owner_id !== user.id) {
    return NextResponse.json({ error: 'Apenas o dono do grupo pode dar upgrade' }, { status: 403 })
  }

  try {
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })
    const payment = new Payment(client)

    // Cria a transação PIX
    const result = await payment.create({
      body: {
        transaction_amount: selectedPkg.amount,
        description: `Upgrade Bolão: ${selectedPkg.description}`,
        payment_method_id: 'pix',
        payer: {
          email: user.email!,
        },
        external_reference: `${groupId}|${selectedPkg.limit}`, // Importante: usamos isso no webhook
      }
    })

    return NextResponse.json({
      success: true,
      payment_id: result.id,
      qr_code: result.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
    })
  } catch (error: any) {
    console.error('Erro no MP:', error)
    return NextResponse.json({ error: 'Falha ao gerar PIX no Mercado Pago' }, { status: 500 })
  }
}
