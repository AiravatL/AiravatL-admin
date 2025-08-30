'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAdminAuthenticated, getCurrentUser } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await isAdminAuthenticated()
        setIsAuthenticated(authenticated)
        
        if (!authenticated) {
          router.push('/login')
        } else {
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/login')
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setIsAuthenticated(false)
          router.push('/login')
        } else if (event === 'SIGNED_IN' && session) {
          setIsAuthenticated(true)
          setIsLoading(false)
        }
      }
    )

    return () => {
      subscription?.unsubscribe()
    }
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return <>{children}</>
}