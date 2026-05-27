import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code || code.trim() === '') {
    return NextResponse.redirect(`${origin}/login`)
  }

  const response = NextResponse.redirect(`${origin}/login`)
  response.cookies.set('pending_invite', code.toUpperCase(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  return response
}
