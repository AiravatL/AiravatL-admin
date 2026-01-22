/**
 * Reset Admin Password Script
 * 
 * This script resets the password for admin@airavatl.com
 * Run with: tsx scripts/reset-admin-password.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function resetAdminPassword() {
  const email = 'admin@airavatl.com'
  const newPassword = 'admin123' // Change this to your desired password
  
  console.log(`Resetting password for ${email}...`)
  
  try {
    // Update password using Admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      (await supabase.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id!,
      { password: newPassword }
    )
    
    if (error) {
      console.error('Error:', error)
      return
    }
    
    console.log('✅ Password reset successfully!')
    console.log(`Email: ${email}`)
    console.log(`New Password: ${newPassword}`)
    console.log('\nYou can now login with these credentials.')
    
  } catch (err) {
    console.error('Error:', err)
  }
}

resetAdminPassword()
