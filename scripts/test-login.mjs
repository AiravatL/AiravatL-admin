/**
 * Interactive Login Test Script
 * 
 * This script tests the Supabase authentication by prompting for credentials
 * and showing detailed error information.
 * 
 * Run with: node scripts/test-login.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '.env.local')
config({ path: envPath })

// Create readline interface for user input
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

// Promisify readline question
const question = (query) => new Promise((resolve) => rl.question(query, resolve))

async function testLogin() {
  console.log('\n🔐 Supabase Auth Login Test\n')
  console.log('═'.repeat(50))
  
  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  console.log('\n📋 Environment Check:')
  console.log(`Supabase URL: ${supabaseUrl ? '✅ ' + supabaseUrl : '❌ Not found'}`)
  console.log(`Anon Key: ${supabaseAnonKey ? '✅ ' + supabaseAnonKey.substring(0, 20) + '...' : '❌ Not found'}`)
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('\n❌ Error: Missing environment variables in .env.local')
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.')
    rl.close()
    return
  }
  
  // Create Supabase client
  console.log('\n🔌 Creating Supabase client...')
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false
    }
  })
  console.log('✅ Client created successfully')
  
  // Get user input
  console.log('\n' + '═'.repeat(50))
  const email = await question('\n📧 Enter email: ')
  const password = await question('🔑 Enter password: ')
  
  console.log('\n' + '═'.repeat(50))
  console.log('\n🔄 Attempting login...\n')
  
  try {
    // Attempt login
    const startTime = Date.now()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password
    })
    const duration = Date.now() - startTime
    
    console.log(`⏱️  Request took ${duration}ms`)
    
    if (error) {
      console.log('\n❌ Login Failed!')
      console.log('\n📊 Error Details:')
      console.log(JSON.stringify(error, null, 2))
      console.log('\n🔍 Error Breakdown:')
      console.log(`Message: ${error.message}`)
      console.log(`Status: ${error.status || 'N/A'}`)
      console.log(`Code: ${error.code || 'N/A'}`)
      
      // Common error explanations
      if (error.message?.includes('Invalid login credentials')) {
        console.log('\n💡 This means: Wrong email or password')
      } else if (error.message?.includes('Email not confirmed')) {
        console.log('\n💡 This means: Email address needs to be verified')
      } else if (error.status === 400) {
        console.log('\n💡 This means: Bad request - check email format or password requirements')
      } else if (error.message?.includes('fetch')) {
        console.log('\n💡 This means: Network error - cannot reach Supabase server')
        console.log('   Check your internet connection and firewall settings')
      }
    } else {
      console.log('\n✅ Login Successful!\n')
      console.log('👤 User Details:')
      console.log(`ID: ${data.user?.id}`)
      console.log(`Email: ${data.user?.email}`)
      console.log(`Email Confirmed: ${data.user?.email_confirmed_at ? '✅ Yes' : '❌ No'}`)
      console.log(`Created: ${data.user?.created_at}`)
      
      console.log('\n🎫 Session Details:')
      console.log(`Access Token: ${data.session?.access_token ? '✅ Present' : '❌ Missing'}`)
      console.log(`Refresh Token: ${data.session?.refresh_token ? '✅ Present' : '❌ Missing'}`)
      console.log(`Expires: ${data.session?.expires_at ? new Date(data.session.expires_at * 1000).toLocaleString() : 'N/A'}`)
      
      // Now check admin_users table
      console.log('\n' + '═'.repeat(50))
      console.log('\n🔍 Checking admin_users table...')
      
      const { data: adminUser, error: adminError } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', email.trim())
        .single()
      
      if (adminError) {
        if (adminError.code === 'PGRST116') {
          console.log('⚠️  User not found in admin_users table')
          console.log('💡 This user exists in auth but is not an admin')
        } else {
          console.log('❌ Error checking admin status:')
          console.log(JSON.stringify(adminError, null, 2))
        }
      } else {
        console.log('✅ Admin User Found!')
        console.log(`Role: ${adminUser.role}`)
        console.log(`Created: ${adminUser.created_at}`)
        console.log(`Last Login: ${adminUser.last_login || 'Never'}`)
      }
    }
    
  } catch (err) {
    console.log('\n💥 Unexpected Error!')
    console.log('\n📊 Error Details:')
    console.error(err)
    
    if (err.message?.includes('fetch')) {
      console.log('\n💡 Network Error Detected:')
      console.log('   - Check if Supabase URL is correct')
      console.log('   - Verify internet connection')
      console.log('   - Check firewall/antivirus settings')
      console.log('   - Try disabling VPN if using one')
    }
  }
  
  console.log('\n' + '═'.repeat(50) + '\n')
  rl.close()
}

// Run the test
testLogin().catch(err => {
  console.error('Fatal error:', err)
  rl.close()
  process.exit(1)
})
