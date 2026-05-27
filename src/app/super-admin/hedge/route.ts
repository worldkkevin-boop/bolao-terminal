import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Lógica de injeção de dados do Supabase para dentro do bolao-hedge.html
  const injectionScript = `
    <script>
      console.log('BOLÃO TERMINAL SaaS Injection Ativado');
      // Sobrescreve a função de carregar palpites para puxar do nosso SaaS
      window.addEventListener('DOMContentLoaded', async () => {
        try {
          const res = await fetch('/api/hedge-data');
          if (!res.ok) return;
          const data = await res.json();
          
          if (data && data.members) {
            // Mapeia os dados do Supabase para o formato que a UI antiga esperava
            const newAccounts = data.members.map((m, i) => ({
              id: m.id,
              name: m.name.split(' ')[0].toUpperCase(), // Primeiro nome
              role: i === 0 ? 'PRIMÁRIO' : (i === 1 ? 'HEDGE' : 'CISNE NEGRO'),
              borderCls: i === 0 ? 'border-acc-grn' : (i === 1 ? 'border-acc-amb' : 'border-acc-vio'),
              textCls: i === 0 ? 'text-acc-grn' : (i === 1 ? 'text-acc-amb' : 'text-acc-vio'),
              glowCls: i === 0 ? 'glow-grn' : ''
            }));
            
            // Se tiver membros, injeta eles no motor do torneio
            if (newAccounts.length > 0) {
              window.ACCOUNTS = newAccounts;
            }

            // O Tracker do HTML esperava os palpites em uma variável de estado.
            // Para injetar 100% requiriria adaptar as funções do HTML original,
            // mas por enquanto, os usuários reais estão sendo listados!
            console.log('Membros carregados do banco:', window.ACCOUNTS);
          }
        } catch(e) {
          console.error('Erro na injeção SaaS', e);
        }
      });
    </script>
  `

  try {
    const htmlPath = path.join(process.cwd(), 'src', 'assets', 'bolao-hedge.html')
    let htmlContent = fs.readFileSync(htmlPath, 'utf8')
    
    // Injeta o script antes de fechar o </body>
    htmlContent = htmlContent.replace('</body>', injectionScript + '</body>')

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
  } catch (err) {
    return NextResponse.json({ error: 'Hedge Engine não encontrado' }, { status: 404 })
  }
}
