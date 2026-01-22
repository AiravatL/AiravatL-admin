"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  Users,
  Truck,
  Gavel,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface DashboardStats {
  totalConsigners: number;
  totalDrivers: number;
  activeAuctions: number;
  totalBids: number;
  completedAuctions: number;
  totalNotifications: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (isSupabaseAvailable()) {
      fetchDashboardStats();
      setupRealTimeSubscriptions();
    } else {
      setLoading(false);
      setError("Supabase configuration not available");
    }

    // Cleanup subscriptions on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  const fetchDashboardStats = useCallback(async () => {
    try {
      // Use parallel queries to fetch all counts efficiently
      const [
        consignersResult,
        driversResult,
        activeAuctionsResult,
        completedAuctionsResult,
        bidsResult,
        notificationsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "consigner"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "driver"),
        supabase
          .from("auctions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("auctions")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("auction_bids")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("auction_notifications")
          .select("*", { count: "exact", head: true }),
      ]);

      // Handle potential null values and errors
      const consignersCount = consignersResult.count || 0;
      const driversCount = driversResult.count || 0;
      const activeAuctionsCount = activeAuctionsResult.count || 0;
      const completedAuctionsCount = completedAuctionsResult.count || 0;
      const bidsCount = bidsResult.count || 0;
      const notificationsCount = notificationsResult.count || 0;

      setStats({
        totalConsigners: consignersCount,
        totalDrivers: driversCount,
        activeAuctions: activeAuctionsCount,
        completedAuctions: completedAuctionsCount,
        totalBids: bidsCount,
        totalNotifications: notificationsCount,
      });

      // Log the actual values for debugging
      console.log("Dashboard Stats:", {
        consigners: consignersCount,
        drivers: driversCount,
        activeAuctions: activeAuctionsCount,
        completedAuctions: completedAuctionsCount,
        bids: bidsCount,
        notifications: notificationsCount,
      });
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
      setError("Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  const setupRealTimeSubscriptions = useCallback(() => {
    console.log("Setting up real-time subscriptions for dashboard");

    // Create a channel for dashboard updates
    const channel = supabase
      .channel("dashboard_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        (payload) => {
          console.log("Profile change detected:", payload);
          fetchDashboardStats();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
        },
        (payload) => {
          console.log("Auction change detected:", payload);
          fetchDashboardStats();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_bids",
        },
        (payload) => {
          console.log("Bid change detected:", payload);
          fetchDashboardStats();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_notifications",
        },
        (payload) => {
          console.log("Notification change detected:", payload);
          fetchDashboardStats();
        },
      )
      .subscribe((status) => {
        console.log("Dashboard subscription status:", status);
      });

    subscriptionRef.current = channel;
  }, [fetchDashboardStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 mr-2" />
          {error}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Consigners",
      value: stats?.totalConsigners || 0,
      icon: Users,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Total Drivers",
      value: stats?.totalDrivers || 0,
      icon: Truck,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Active Auctions",
      value: stats?.activeAuctions || 0,
      icon: Gavel,
      color: "bg-yellow-500",
      textColor: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Total Bids",
      value: stats?.totalBids || 0,
      icon: DollarSign,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Completed Auctions",
      value: stats?.completedAuctions || 0,
      icon: TrendingUp,
      color: "bg-indigo-500",
      textColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Notifications Sent",
      value: stats?.totalNotifications || 0,
      icon: AlertCircle,
      color: "bg-red-500",
      textColor: "text-red-600",
      bgColor: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of platform metrics
        </p>
      </div>

      {/* Stats Grid - Clean Minimal Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, index) => (
          <div
            key={index}
            className="group bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-3">
                  <div className={`p-1.5 rounded-md ${card.bgColor}`}>
                    <card.icon className={`w-4 h-4 ${card.textColor}`} />
                  </div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {card.title}
                  </p>
                </div>
                <p className="text-3xl font-semibold text-gray-900">
                  {card.value.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Insights - Clean Minimal Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-gray-900">
              Platform Activity
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Active Users</span>
              <span className="text-sm font-semibold text-gray-900">
                {(stats?.totalConsigners || 0) + (stats?.totalDrivers || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.activeAuctions &&
                stats.activeAuctions + stats.completedAuctions > 0
                  ? Math.round(
                      (stats.completedAuctions /
                        (stats.activeAuctions + stats.completedAuctions)) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Avg Bids/Auction</span>
              <span className="text-sm font-semibold text-gray-900">
                {stats?.completedAuctions && stats.completedAuctions > 0
                  ? Math.round(
                      ((stats?.totalBids || 0) / stats.completedAuctions) * 10,
                    ) / 10
                  : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-1 h-5 bg-green-500 rounded-full"></div>
            <h3 className="text-sm font-medium text-gray-900">System Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Database</span>
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium text-gray-900">
                  Online
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">Notifications</span>
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium text-gray-900">
                  Active
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Auto-Completion</span>
              <div className="flex items-center space-x-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span className="text-xs font-medium text-gray-900">
                  Enabled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
