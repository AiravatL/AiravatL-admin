import { supabase } from './supabase'
import { User } from '@supabase/supabase-js'

export interface AdminSession {
  user: User
  adminProfile: any
  isAuthenticated: boolean
}

// Sign in with email and password using Supabase Auth
export const signInAdmin = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      throw error
    }

    // Check if user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single()

    if (adminError && adminError.code !== 'PGRST116') {
      throw new Error('Access denied: Not authorized as admin')
    }

    // Update last login if admin user exists
    if (adminUser) {
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', adminUser.id)
    }

    return { 
      user: data.user, 
      session: data.session,
      adminProfile: adminUser 
    }
  } catch (error) {
    throw error
  }
}

// Sign out admin
export const signOutAdmin = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw error
    }
  } catch (error) {
    throw error
  }
}

// Get current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      throw error
    }
    return session
  } catch (error) {
    throw error
  }
}

// Check if user is authenticated and is an admin
export const isAdminAuthenticated = async (): Promise<boolean> => {
  try {
    const session = await getCurrentSession()
    if (!session?.user) {
      return false
    }

    // Check if user exists in admin_users table
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', session.user.email)
      .single()

    return !!adminUser && !error
  } catch (error) {
    return false
  }
}

// Get current user and admin profile
export const getCurrentAdminUser = async (): Promise<{ user: User; adminProfile: any } | null> => {
  try {
    const session = await getCurrentSession()
    if (!session?.user) {
      return null
    }

    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', session.user.email)
      .single()

    if (error || !adminUser) {
      return null
    }

    return {
      user: session.user,
      adminProfile: adminUser
    }
  } catch (error) {
    return null
  }
}

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const session = await getCurrentSession()
    return session?.user || null
  } catch (error) {
    return null
  }
}