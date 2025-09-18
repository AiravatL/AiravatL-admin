import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if the user is trying to access protected routes
  const protectedPaths = ['/dashboard', '/consigners', '/drivers', '/auctions', '/bids']
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  )

  // If it's a protected path, check for admin authentication
  if (isProtectedPath) {
    // In a real app, you'd check for a JWT token or session
    // For now, we'll rely on client-side localStorage check
    // This is handled in the layout component
  }

  // If accessing root, redirect to login
  if (request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
}