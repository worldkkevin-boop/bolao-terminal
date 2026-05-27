import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const cookieStore = await cookies()
      const pendingInvite = cookieStore.get('pending_invite')

      const forwardedHost = request.headers.get('x-forwarded-host')
      const baseUrl = process.env.NODE_ENV === 'development' || !forwardedHost
        ? origin
        : `https://${forwardedHost}`

      if (pendingInvite?.value) {
        const response = NextResponse.redirect(`${baseUrl}/join/${pendingInvite.value}`)
        response.cookies.set('pending_invite', '', { maxAge: 0, path: '/' })
        return response
      }

      return NextResponse.redirect(`${baseUrl}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
