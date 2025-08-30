import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on your Supabase schema
export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: 'super_admin' | 'admin'
          created_at: string
          updated_at: string
          last_login: string | null
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          role?: 'super_admin' | 'admin'
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: 'super_admin' | 'admin'
          created_at?: string
          updated_at?: string
          last_login?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          role: 'consigner' | 'driver'
          phone_number: string | null
          address: string | null
          upi_id: string | null
          vehicle_type: 'three_wheeler' | 'pickup_truck' | 'mini_truck' | 'medium_truck' | 'large_truck' | null
          push_token: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
          first_name: string | null
          middle_name: string | null
          last_name: string | null
          email: string | null
          vehicle_number: string | null
        }
      }
      auctions: {
        Row: {
          id: string
          title: string
          description: string
          vehicle_type: 'three_wheeler' | 'pickup_truck' | 'mini_truck' | 'medium_truck' | 'large_truck'
          start_time: string
          end_time: string
          consignment_date: string
          status: 'active' | 'completed' | 'cancelled'
          created_by: string
          winner_id: string | null
          winning_bid_id: string | null
          created_at: string
          updated_at: string
          bid_count: number | null
          lowest_bid_amount: number | null
          highest_bid_amount: number | null
        }
      }
      auction_bids: {
        Row: {
          id: string
          auction_id: string
          user_id: string
          amount: number
          is_winning_bid: boolean | null
          created_at: string
        }
      }
      auction_notifications: {
        Row: {
          id: string
          user_id: string
          auction_id: string | null
          type: string
          message: string
          is_read: boolean | null
          data: any
          created_at: string
        }
      }
      auction_audit_logs: {
        Row: {
          id: string
          auction_id: string | null
          user_id: string | null
          action: string
          details: any
          created_at: string
        }
      }
    }
  }
}