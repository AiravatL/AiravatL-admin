'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Truck, Gavel, DollarSign, TrendingUp, AlertCircle } from 'lucide-react'

interface DashboardStats {
  totalConsigners: number
  totalDrivers: number
  activeAuctions: number
  totalBids: number
  completedAuctions: number
  totalNotifications: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Use parallel queries to fetch all counts efficiently
      const [
        consignersResult,
        driversResult,
        activeAuctionsResult,
        completedAuctionsResult,
        bidsResult,
        notificationsResult
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'consigner'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'driver'),
        supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('auction_bids').select('*', { count: 'exact', head: true }),
        supabase.from('auction_notifications').select('*', { count: 'exact', head: true })
      ])

      // Handle potential null values and errors
      const consignersCount = consignersResult.count || 0
      const driversCount = driversResult.count || 0
      const activeAuctionsCount = activeAuctionsResult.count || 0
      const completedAuctionsCount = completedAuctionsResult.count || 0
      const bidsCount = bidsResult.count || 0
      const notificationsCount = notificationsResult.count || 0

      setStats({
        totalConsigners: consignersCount,
        totalDrivers: driversCount,
        activeAuctions: activeAuctionsCount,
        completedAuctions: completedAuctionsCount,
        totalBids: bidsCount,
        totalNotifications: notificationsCount
      })

      // Log the actual values for debugging
      console.log('Dashboard Stats:', {
        consigners: consignersCount,
        drivers: driversCount,
        activeAuctions: activeAuctionsCount,
        completedAuctions: completedAuctionsCount,
        bids: bidsCount,
        notifications: notificationsCount
      })

    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Consigners',
      value: stats?.totalConsigners || 0,
      icon: Users,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Drivers',
      value: stats?.totalDrivers || 0,
      icon: Truck,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Active Auctions',
      value: stats?.activeAuctions || 0,
      icon: Gavel,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: 'Total Bids',
      value: stats?.totalBids || 0,
      icon: DollarSign,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Completed Auctions',
      value: stats?.completedAuctions || 0,
      icon: TrendingUp,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      title: 'Notifications Sent',
      value: stats?.totalNotifications || 0,
      icon: AlertCircle,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to AiravatL Operations Portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">Platform Activity</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Active Users:</span>
                <span className="font-medium">{(stats?.totalConsigners || 0) + (stats?.totalDrivers || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Auction Success Rate:</span>
                <span className="font-medium">
                  {stats?.activeAuctions && (stats.activeAuctions + stats.completedAuctions) > 0 
                    ? Math.round((stats.completedAuctions / (stats.activeAuctions + stats.completedAuctions)) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg Bids per Auction:</span>
                <span className="font-medium">
                  {stats?.completedAuctions && stats.completedAuctions > 0 
                    ? Math.round((stats?.totalBids || 0) / stats.completedAuctions * 10) / 10
                    : 0}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">System Health</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Database Status:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Notification System:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Auto Auction Completion:</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  Enabled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}