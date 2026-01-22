"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  Gavel,
  TrendingUp,
  Package,
  Award,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Truck,
  Activity,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Phone,
} from "lucide-react";
import Link from "next/link";

interface AuctionStats {
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  cancelledAuctions: number;
  incompleteAuctions: number;
  totalBidsPlaced: number;
  avgBidsPerAuction: number;
  vehicleTypeDistribution: { [key: string]: number };
  recentActivity: any[];
}

interface Auction {
  id: string;
  title: string;
  description: string;
  vehicle_type: string;
  start_time: string;
  end_time: string;
  consignment_date: string;
  status: "active" | "completed" | "cancelled" | "incomplete";
  created_by: string;
  winner_id: string | null;
  winning_bid_id: string | null;
  created_at: string;
  updated_at: string;
  bid_count: number | null;
  lowest_bid_amount: number | null;
  highest_bid_amount: number | null;
  // Related data
  consigner?: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone_number: string | null;
  };
  winner?: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    vehicle_number: string | null;
    phone_number: string | null;
  };
  bids?: any[];
}

export default function AuctionsPage() {
  const [stats, setStats] = useState<AuctionStats | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [filteredAuctions, setFilteredAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "created" | "end_time" | "bids" | "title"
  >("created");
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const [backgroundUpdateCount, setBackgroundUpdateCount] = useState(0);
  const [isPollingActive, setIsPollingActive] = useState(false);
  const lastActiveTimeRef = useRef<Date>(new Date());
  const isPageVisibleRef = useRef<boolean>(true);

  const vehicleTypes = [
    "three_wheeler",
    "pickup_truck",
    "mini_truck",
    "medium_truck",
    "large_truck",
  ];
  const statusTypes = ["active", "completed", "cancelled", "incomplete"];

  useEffect(() => {
    if (isSupabaseAvailable()) {
      fetchAuctionData();
      setupRealTimeSubscriptions();
      setupSmartPolling();
      setupPageVisibilityListener();
    } else {
      setLoading(false);
      // Set demo data when Supabase is not available
      setStats({
        totalAuctions: 12,
        activeAuctions: 4,
        completedAuctions: 7,
        cancelledAuctions: 1,
        incompleteAuctions: 0,
        totalBidsPlaced: 89,
        avgBidsPerAuction: 7.4,
        vehicleTypeDistribution: { truck: 8, mini_truck: 3, van: 1 },
        recentActivity: [],
      });
      setAuctions([
        {
          id: "sample-1",
          title: "Mumbai to Delhi Transport",
          description:
            "Urgent delivery of electronics equipment from Mumbai to Delhi",
          vehicle_type: "truck",
          status: "active",
          start_time: "2024-01-15T10:00:00Z",
          end_time: "2024-01-20T18:00:00Z",
          consignment_date: "2024-01-25T08:00:00Z",
          created_by: "john-doe",
          winner_id: null,
          winning_bid_id: null,
          created_at: "2024-01-15T09:00:00Z",
          updated_at: "2024-01-15T09:00:00Z",
          bid_count: 5,
          lowest_bid_amount: 42000,
          highest_bid_amount: 58000,
          consigner: {
            id: "john-doe",
            username: "johnlogistics",
            first_name: "John",
            last_name: "Logistics",
            email: "john@example.com",
            phone_number: "+91 98765 43210",
          },
          bids: [],
        },
        {
          id: "sample-2",
          title: "Bangalore to Chennai Route",
          description: "Regular cargo delivery service between tech hubs",
          vehicle_type: "mini_truck",
          status: "completed",
          start_time: "2024-01-10T10:00:00Z",
          end_time: "2024-01-15T18:00:00Z",
          consignment_date: "2024-01-18T08:00:00Z",
          created_by: "tech-corp",
          winner_id: "fast-transport",
          winning_bid_id: "bid-1",
          created_at: "2024-01-10T09:00:00Z",
          updated_at: "2024-01-15T20:00:00Z",
          bid_count: 8,
          lowest_bid_amount: 23000,
          highest_bid_amount: 29000,
          consigner: {
            id: "tech-corp",
            username: "techcorp",
            first_name: "Tech",
            last_name: "Corporation",
            email: "logistics@techcorp.com",
            phone_number: "+91 87654 32109",
          },
          winner: {
            id: "fast-transport",
            username: "fasttransport",
            first_name: "Fast",
            last_name: "Transport",
            vehicle_number: "MH 12 AB 3456",
            phone_number: "+91 76543 21098",
          },
          bids: [{ amount: "25000" }],
        },
      ]);
      setFilteredAuctions([]);
    }

    // Cleanup subscriptions and polling on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    filterAuctions();
  }, [auctions, searchTerm, statusFilter, vehicleFilter, sortBy]);

  const fetchAuctionData = useCallback(async (isBackgroundUpdate = false) => {
    try {
      if (isBackgroundUpdate) {
        setBackgroundUpdateCount((prev) => prev + 1);
      }

      // Fetch auctions with related data - using pre-computed bid statistics for performance
      const { data: auctionsData, error: auctionsError } = await supabase
        .from("auctions")
        .select(
          `
          id, title, description, vehicle_type, start_time, end_time, consignment_date,
          status, created_by, winner_id, winning_bid_id, created_at, updated_at,
          bid_count, lowest_bid_amount, highest_bid_amount,
          profiles!auctions_created_by_fkey (
            id, username, first_name, last_name, email, phone_number
          ),
          winner:profiles!auctions_winner_id_fkey (
            id, username, first_name, last_name, vehicle_number, phone_number
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (auctionsError) throw auctionsError;

      // No need for additional queries - bid stats are already computed in the database
      // This eliminates the N+1 query problem that was causing slow loading
      const auctionsWithBids = auctionsData.map((auction) => ({
        ...auction,
        consigner: auction.profiles,
        winner: auction.winner,
      }));

      setAuctions(auctionsWithBids);
      setLastUpdateTime(new Date());

      // Calculate statistics
      const totalAuctions = auctionsWithBids.length;
      const activeAuctions = auctionsWithBids.filter(
        (a) => a.status === "active",
      ).length;
      const completedAuctions = auctionsWithBids.filter(
        (a) => a.status === "completed",
      ).length;
      const cancelledAuctions = auctionsWithBids.filter(
        (a) => a.status === "cancelled",
      ).length;
      const incompleteAuctions = auctionsWithBids.filter(
        (a) => a.status === "incomplete",
      ).length;
      const totalBidsPlaced = auctionsWithBids.reduce(
        (sum, a) => sum + (a.bid_count || 0),
        0,
      );
      const avgBidsPerAuction =
        totalAuctions > 0 ? totalBidsPlaced / totalAuctions : 0;

      // Vehicle type distribution
      const vehicleTypeDistribution: { [key: string]: number } = {};
      auctionsWithBids.forEach((auction) => {
        const vehicleType = auction.vehicle_type || "unknown";
        vehicleTypeDistribution[vehicleType] =
          (vehicleTypeDistribution[vehicleType] || 0) + 1;
      });

      // Get recent activity
      const { data: recentActivity } = await supabase
        .from("auction_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      setStats({
        totalAuctions,
        activeAuctions,
        completedAuctions,
        cancelledAuctions,
        incompleteAuctions,
        totalBidsPlaced,
        avgBidsPerAuction,
        vehicleTypeDistribution,
        recentActivity: recentActivity || [],
      });
    } catch (err: any) {
      console.error("Error fetching auction data:", err);
      setError(err.message);
      setIsRealTimeConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const setupRealTimeSubscriptions = useCallback(() => {
    console.log("Setting up real-time subscriptions for auctions");

    // Create a channel for critical real-time updates only
    const channel = supabase
      .channel("critical_auctions_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
        },
        (payload) => {
          console.log("Critical auction change detected:", payload);
          // Only refresh for important changes (status updates, winner changes)
          if (
            payload.eventType === "UPDATE" &&
            (payload.new?.status !== payload.old?.status ||
              payload.new?.winner_id !== payload.old?.winner_id)
          ) {
            fetchAuctionData(true);
          } else if (
            payload.eventType === "INSERT" ||
            payload.eventType === "DELETE"
          ) {
            fetchAuctionData(true);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auction_bids",
        },
        (payload) => {
          console.log("New bid detected:", payload);
          // Only refresh for new bids, not all bid changes
          fetchAuctionData(true);
        },
      )
      .subscribe((status) => {
        console.log("Real-time subscription status:", status);
        setIsRealTimeConnected(status === "SUBSCRIBED");
      });

    subscriptionRef.current = channel;
  }, [fetchAuctionData]);

  const setupSmartPolling = useCallback(() => {
    console.log("Setting up smart polling for auctions");

    const startPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      // Dynamic polling interval based on page activity
      const getPollingInterval = () => {
        const now = new Date();
        const timeSinceLastActive =
          now.getTime() - lastActiveTimeRef.current.getTime();

        // If page is not visible, poll less frequently
        if (!isPageVisibleRef.current) {
          return 300000; // 5 minutes when not visible
        }

        // If user has been inactive for more than 5 minutes, reduce polling
        if (timeSinceLastActive > 300000) {
          return 120000; // 2 minutes for inactive users
        }

        // Active users get frequent updates
        return 30000; // 30 seconds for active users
      };

      const poll = () => {
        if (isSupabaseAvailable() && isPageVisibleRef.current) {
          fetchAuctionData(true);
        }

        // Reset timer with new interval
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
        }
        pollingRef.current = setTimeout(poll, getPollingInterval());
      };

      pollingRef.current = setTimeout(poll, getPollingInterval());
      setIsPollingActive(true);
    };

    startPolling();
  }, [fetchAuctionData]);

  const setupPageVisibilityListener = useCallback(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;

      if (isPageVisibleRef.current) {
        // Page became visible - update data immediately and reset active time
        lastActiveTimeRef.current = new Date();
        fetchAuctionData(true);
      }
    };

    const handleUserActivity = () => {
      lastActiveTimeRef.current = new Date();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("mousedown", handleUserActivity);
    document.addEventListener("keydown", handleUserActivity);
    document.addEventListener("scroll", handleUserActivity);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("mousedown", handleUserActivity);
      document.removeEventListener("keydown", handleUserActivity);
      document.removeEventListener("scroll", handleUserActivity);
    };
  }, [fetchAuctionData]);

  const filterAuctions = () => {
    let filtered = [...auctions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (auction) =>
          auction.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          auction.description
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          auction.consigner?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          auction.winner?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((auction) => auction.status === statusFilter);
    }

    // Vehicle type filter
    if (vehicleFilter !== "all") {
      filtered = filtered.filter(
        (auction) => auction.vehicle_type === vehicleFilter,
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "end_time":
          return (
            new Date(a.end_time).getTime() - new Date(b.end_time).getTime()
          );
        case "bids":
          return (b.bid_count || 0) - (a.bid_count || 0);
        case "created":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    setFilteredAuctions(filtered);
  };

  const formatVehicleType = (type: string) => {
    return type
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Clock className="w-4 h-4 text-green-600" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-blue-600" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-600" />;
      case "incomplete":
        return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
      incomplete: "bg-yellow-100 text-yellow-800",
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${
      styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800"
    }`;
  };

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
          <Activity className="w-5 h-5 mr-2" />
          Error loading auction data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Real-time Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Auctions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor and manage auction activities
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isRealTimeConnected ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            <span>
              {isRealTimeConnected ? "Real-time Connected" : "Polling Mode"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Updated: {lastUpdateTime.toLocaleTimeString()}</span>
          </div>
          {backgroundUpdateCount > 0 && (
            <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
              {backgroundUpdateCount} background updates
            </div>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 rounded-md bg-blue-50">
                  <Gavel className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total
                </p>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {stats?.totalAuctions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 rounded-md bg-green-50">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Active Auctions
                </p>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {stats?.activeAuctions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 rounded-md bg-purple-50">
                  <Package className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Completed
                </p>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {stats?.completedAuctions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 rounded-md bg-yellow-50">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Incomplete
                </p>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {stats?.incompleteAuctions || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-1.5 rounded-md bg-orange-50">
                  <DollarSign className="w-4 h-4 text-orange-600" />
                </div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Total Bids
                </p>
              </div>
              <p className="text-3xl font-semibold text-gray-900">
                {stats?.totalBidsPlaced || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Type Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
          <h2 className="text-sm font-medium text-gray-900">
            Auction Distribution by Vehicle Type
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(stats?.vehicleTypeDistribution || {}).map(
            ([type, count]) => (
              <div key={type} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <Truck className="w-6 h-6 text-gray-600" />
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  {formatVehicleType(type)}
                </p>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">
                  {((count / (stats?.totalAuctions || 1)) * 100).toFixed(1)}%
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-all">
        <div className="flex flex-col space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search auctions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
              >
                <option value="all">All Status</option>
                {statusTypes.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Vehicles</option>
              {vehicleTypes.map((type) => (
                <option key={type} value={type}>
                  {formatVehicleType(type)}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="created">Recently Created</option>
              <option value="title">Title A-Z</option>
              <option value="end_time">End Time</option>
              <option value="bids">Most Bids</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden xl:block">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-1/4">
                  Auction
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-1/6">
                  Consigner
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-20">
                  Vehicle
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-20">
                  Status
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-16">
                  Bids
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-1/6">
                  Winner
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900 w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAuctions.map((auction) => (
                <tr
                  key={auction.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900 truncate text-sm">
                        {auction.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {auction.description}
                      </p>
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        Ends: {new Date(auction.end_time).toLocaleDateString()}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {auction.consigner?.first_name ||
                        auction.consigner?.last_name
                          ? `${auction.consigner.first_name || ""} ${
                              auction.consigner.last_name || ""
                            }`.trim()
                          : auction.consigner?.username}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        @{auction.consigner?.username}
                      </p>
                      {auction.consigner?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {auction.consigner.phone_number}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium block truncate">
                      {formatVehicleType(auction.vehicle_type).split(" ")[0]}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center">
                      {getStatusIcon(auction.status)}
                      <span
                        className={`ml-1 text-xs ${getStatusBadge(auction.status)}`}
                      >
                        {auction.status?.charAt(0).toUpperCase() +
                          auction.status?.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 text-sm">
                        {auction.bid_count || 0}
                      </p>
                      {auction.lowest_bid_amount && (
                        <p className="text-xs text-gray-500">
                          ₹{(auction.lowest_bid_amount / 1000).toFixed(0)}k
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    {auction.winner ? (
                      <div>
                        <p className="font-medium text-green-700 text-sm truncate">
                          {auction.winner.first_name || auction.winner.last_name
                            ? `${auction.winner.first_name || ""} ${
                                auction.winner.last_name || ""
                              }`.trim()
                            : auction.winner.username}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {auction.winner.vehicle_number}
                        </p>
                        {auction.winner.phone_number && (
                          <p className="text-xs text-gray-600 flex items-center mt-1">
                            <Phone className="w-3 h-3 mr-1" />
                            {auction.winner.phone_number}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/auctions/${auction.id}`}
                      className="inline-flex items-center justify-center w-full px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tablet View */}
        <div className="hidden lg:block xl:hidden">
          <div className="space-y-3">
            {filteredAuctions.map((auction) => (
              <div
                key={auction.id}
                className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">
                      {auction.title}
                    </h3>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {auction.description}
                    </p>
                  </div>
                  <div className="flex items-center ml-4">
                    {getStatusIcon(auction.status)}
                    <span className={`ml-1 ${getStatusBadge(auction.status)}`}>
                      {auction.status?.charAt(0).toUpperCase() +
                        auction.status?.slice(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                  <div>
                    <p className="text-gray-600 text-xs mb-1">Consigner</p>
                    <p className="font-medium text-gray-900 text-sm truncate">
                      {auction.consigner?.first_name ||
                      auction.consigner?.last_name
                        ? `${auction.consigner.first_name || ""} ${
                            auction.consigner.last_name || ""
                          }`.trim()
                        : auction.consigner?.username}
                    </p>
                    {auction.consigner?.phone_number && (
                      <p className="text-xs text-gray-600 flex items-center mt-1">
                        <Phone className="w-3 h-3 mr-1" />
                        {auction.consigner.phone_number}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs mb-1">Vehicle</p>
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                      {formatVehicleType(auction.vehicle_type)}
                    </span>
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs mb-1">Bids</p>
                    <p className="font-semibold text-gray-900">
                      {auction.bid_count || 0}
                    </p>
                    {auction.lowest_bid_amount && (
                      <p className="text-xs text-gray-500">
                        ₹{auction.lowest_bid_amount?.toLocaleString()}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-gray-600 text-xs mb-1">Winner</p>
                    {auction.winner ? (
                      <div>
                        <p className="font-medium text-green-700 text-sm truncate">
                          {auction.winner.first_name || auction.winner.last_name
                            ? `${auction.winner.first_name || ""} ${
                                auction.winner.last_name || ""
                              }`.trim()
                            : auction.winner.username}
                        </p>
                        {auction.winner.phone_number && (
                          <p className="text-xs text-gray-600 flex items-center mt-1">
                            <Phone className="w-3 h-3 mr-1" />
                            {auction.winner.phone_number}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Ends: {new Date(auction.end_time).toLocaleDateString()}
                    </div>
                  </div>
                  <Link
                    href={`/auctions/${auction.id}`}
                    className="inline-flex items-center px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-4">
          {filteredAuctions.map((auction) => (
            <div
              key={auction.id}
              className="border border-gray-200 rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {auction.title}
                  </h3>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {auction.description}
                  </p>
                </div>
                <div className="flex items-center ml-4">
                  {getStatusIcon(auction.status)}
                  <span className={`ml-1 ${getStatusBadge(auction.status)}`}>
                    {auction.status?.charAt(0).toUpperCase() +
                      auction.status?.slice(1)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Consigner</p>
                  <div className="flex items-center">
                    <User className="w-4 h-4 text-gray-400 mr-2" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {auction.consigner?.first_name ||
                        auction.consigner?.last_name
                          ? `${auction.consigner.first_name || ""} ${
                              auction.consigner.last_name || ""
                            }`.trim()
                          : auction.consigner?.username}
                      </p>
                      {auction.consigner?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {auction.consigner.phone_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 mb-1">Vehicle Type</p>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                    {formatVehicleType(auction.vehicle_type)}
                  </span>
                </div>

                <div>
                  <p className="text-gray-600 mb-1">Bids</p>
                  <p className="font-semibold text-gray-900">
                    {auction.bid_count || 0}
                  </p>
                  {auction.lowest_bid_amount && auction.highest_bid_amount && (
                    <p className="text-xs text-gray-500">
                      ₹{auction.lowest_bid_amount?.toLocaleString()} - ₹
                      {auction.highest_bid_amount?.toLocaleString()}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-gray-600 mb-1">Winner</p>
                  {auction.winner ? (
                    <div>
                      <p className="font-medium text-green-700 text-sm">
                        {auction.winner.first_name || auction.winner.last_name
                          ? `${auction.winner.first_name || ""} ${
                              auction.winner.last_name || ""
                            }`.trim()
                          : auction.winner.username}
                      </p>
                      {auction.winner.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {auction.winner.phone_number}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <div className="flex items-center mb-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    Ends: {new Date(auction.end_time).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Truck className="w-3 h-3 mr-1" />
                    Job:{" "}
                    {new Date(auction.consignment_date).toLocaleDateString()}
                  </div>
                </div>
                <Link
                  href={`/auctions/${auction.id}`}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredAuctions.length === 0 && (
          <div className="text-center py-12">
            <Gavel className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              No auctions found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
