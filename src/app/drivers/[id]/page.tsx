"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  ArrowLeft,
  Calendar,
  User,
  Truck,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Eye,
  Settings,
  Edit3,
  Activity,
  DollarSign,
  Trophy,
  Target,
  BarChart3,
  Filter,
  Search,
  Star,
  Zap,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface DriverProfile {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  vehicle_type: string | null;
  vehicle_number: string | null;
  upi_id: string | null;
  created_at: string;
  updated_at: string;
  role: string;
}

interface DriverBidHistory {
  bid_id: string;
  auction_id: string;
  bid_amount: number;
  bid_created_at: string;
  is_winning_bid: boolean;
  // Auction details
  id: string;
  title: string;
  description: string;
  vehicle_type: string;
  start_time: string;
  end_time: string;
  consignment_date: string;
  status: "active" | "completed" | "cancelled" | "incomplete";
  created_at: string;
  updated_at: string;
  // Consigner details
  consigner_username: string;
  consigner_phone: string | null;
  consigner_address: string | null;
}

interface DriverStats {
  totalBids: number;
  wonAuctions: number;
  activeAuctions: number;
  completedJobs: number;
  winRate: number;
  avgBidAmount: number;
  totalEarnings: number;
  avgJobValue: number;
  responsiveness: number; // Based on bid timing
  preferredVehicleTypes: { type: string; count: number }[];
}

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [bidHistory, setBidHistory] = useState<DriverBidHistory[]>([]);
  const [filteredBids, setFilteredBids] = useState<DriverBidHistory[]>([]);
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
  const subscriptionRef = useRef<any>(null);

  // Profile editing states
  const [editingProfile, setEditingProfile] = useState<DriverProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (driverId && isSupabaseAvailable()) {
      fetchDriverData();
      setupRealTimeSubscriptions();
    } else if (driverId && !isSupabaseAvailable()) {
      setLoading(false);
      setError("Supabase configuration not available");
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [driverId]);

  useEffect(() => {
    filterBids();
  }, [bidHistory, searchTerm, statusFilter]);

  const fetchDriverData = useCallback(async () => {
    if (!driverId) return;

    try {
      const [driverResult, bidHistoryResult] = await Promise.all([
        // Get driver profile
        supabase
          .from("profiles")
          .select("*")
          .eq("id", driverId)
          .eq("role", "driver")
          .single(),

        // Get driver bid history using auction_bids with joins
        supabase
          .from("auction_bids")
          .select(`
            id,
            auction_id,
            amount,
            created_at,
            is_winning_bid,
            auctions!auction_bids_auction_id_fkey (
              id,
              title,
              description,
              vehicle_type,
              start_time,
              end_time,
              consignment_date,
              status,
              created_at,
              updated_at,
              profiles!auctions_created_by_fkey (
                username,
                phone_number,
                address
              )
            )
          `)
          .eq("user_id", driverId)
          .order("created_at", { ascending: false }),
      ]);

      if (driverResult.error) {
        if (driverResult.error.code === "PGRST116") {
          throw new Error("Driver not found");
        }
        throw driverResult.error;
      }
      if (bidHistoryResult.error) throw bidHistoryResult.error;

      const driverData = driverResult.data;
      const rawBidHistoryData = bidHistoryResult.data || [];

      // Transform the bid history data to match our interface
      const transformedBidHistory = rawBidHistoryData.map((bid: any) => ({
        bid_id: bid.id,
        auction_id: bid.auction_id,
        bid_amount: parseFloat(bid.amount),
        bid_created_at: bid.created_at,
        is_winning_bid: bid.is_winning_bid,
        // Auction details
        id: bid.auctions?.id || bid.auction_id,
        title: bid.auctions?.title || "Unknown Auction",
        description: bid.auctions?.description || "",
        vehicle_type: bid.auctions?.vehicle_type || "",
        start_time: bid.auctions?.start_time || "",
        end_time: bid.auctions?.end_time || "",
        consignment_date: bid.auctions?.consignment_date || "",
        status: bid.auctions?.status || "unknown",
        created_at: bid.auctions?.created_at || "",
        updated_at: bid.auctions?.updated_at || "",
        // Consigner details
        consigner_username: bid.auctions?.profiles?.username || "Unknown",
        consigner_phone: bid.auctions?.profiles?.phone_number || null,
        consigner_address: bid.auctions?.profiles?.address || null,
      }));

      setDriver(driverData);
      setBidHistory(transformedBidHistory);

      // Calculate statistics
      const stats = calculateDriverStats(transformedBidHistory);
      setStats(stats);
    } catch (err: any) {
      console.error("Error fetching driver data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  const setupRealTimeSubscriptions = useCallback(() => {
    if (!driverId) return;

    console.log("Setting up real-time subscriptions for driver:", driverId);

    const channel = supabase
      .channel(`driver_${driverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auction_bids",
          filter: `user_id=eq.${driverId}`,
        },
        (payload) => {
          console.log("Driver bid change detected:", payload);
          fetchDriverData();
        }
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
          // Refresh to get updated auction statuses
          fetchDriverData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${driverId}`,
        },
        (payload) => {
          console.log("Driver profile change detected:", payload);
          fetchDriverData();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        setRealtimeStatus(status);
      });

    subscriptionRef.current = channel;
  }, [driverId, fetchDriverData]);

  const calculateDriverStats = (bidHistoryData: DriverBidHistory[]): DriverStats => {
    const totalBids = bidHistoryData.length;
    const wonBids = bidHistoryData.filter((bid) => bid.is_winning_bid).length;
    const activeAuctions = bidHistoryData.filter((bid) => bid.status === "active").length;
    const completedJobs = bidHistoryData.filter(
      (bid) => bid.is_winning_bid && bid.status === "completed"
    ).length;

    const winRate = totalBids > 0 ? (wonBids / totalBids) * 100 : 0;

    const avgBidAmount = totalBids > 0
      ? bidHistoryData.reduce((sum, bid) => sum + bid.bid_amount, 0) / totalBids
      : 0;

    const totalEarnings = bidHistoryData
      .filter((bid) => bid.is_winning_bid && bid.status === "completed")
      .reduce((sum, bid) => sum + bid.bid_amount, 0);

    const avgJobValue = completedJobs > 0 ? totalEarnings / completedJobs : 0;

    // Calculate responsiveness based on bid timing (simplified)
    const responsiveness = 85; // Placeholder - could be calculated based on bid timing vs auction start

    // Group by vehicle types
    const vehicleTypeMap = new Map();
    bidHistoryData.forEach((bid) => {
      const type = bid.vehicle_type;
      vehicleTypeMap.set(type, (vehicleTypeMap.get(type) || 0) + 1);
    });

    const preferredVehicleTypes = Array.from(vehicleTypeMap.entries())
      .map(([type, count]) => ({ type, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      totalBids,
      wonAuctions: wonBids,
      activeAuctions,
      completedJobs,
      winRate,
      avgBidAmount,
      totalEarnings,
      avgJobValue,
      responsiveness,
      preferredVehicleTypes,
    };
  };

  const filterBids = () => {
    let filtered = [...bidHistory];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((bid) => bid.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (bid) =>
          bid.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bid.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bid.consigner_username.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredBids(filtered);
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
      active: "bg-green-100 text-green-800 border-green-200",
      completed: "bg-blue-100 text-blue-800 border-blue-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      incomplete: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return `px-2 py-1 rounded-full text-xs font-medium border ${
      styles[status as keyof typeof styles] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    }`;
  };

  const getUserDisplayName = (driver: DriverProfile | null) => {
    if (!driver) return "Unknown Driver";
    if (driver.first_name || driver.last_name) {
      return `${driver.first_name || ""} ${driver.last_name || ""}`.trim();
    }
    return driver.username || "Unknown Driver";
  };

  const handleEditProfile = () => {
    if (driver) {
      setEditingProfile({ ...driver });
      setShowEditProfile(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingProfile || !driver) return;

    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: editingProfile.first_name,
          last_name: editingProfile.last_name,
          email: editingProfile.email,
          phone_number: editingProfile.phone_number,
          address: editingProfile.address,
          vehicle_type: editingProfile.vehicle_type,
          vehicle_number: editingProfile.vehicle_number,
          upi_id: editingProfile.upi_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", driver.id);

      if (error) throw error;

      // Refresh driver data
      await fetchDriverData();
      setShowEditProfile(false);
      setError(null);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile: " + err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingProfile(null);
    setShowEditProfile(false);
  };

  const handleDeleteDriver = async () => {
    if (!driver) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/delete-driver?id=${driver.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete driver");
      }

      // Redirect to drivers list after successful deletion
      router.push("/drivers");
    } catch (err: any) {
      console.error("Error deleting driver:", err);
      setError("Failed to delete driver: " + err.message);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/drivers"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Drivers
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Error loading driver details: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/drivers"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Drivers
          </Link>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Driver not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <Link
            href="/drivers"
            className="flex items-center text-indigo-600 hover:text-indigo-700 mt-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Drivers
          </Link>
        </div>
        <div className="flex items-center space-x-3">
          {/* Real-time status indicator */}
          <div className="flex items-center text-xs">
            <div className={`w-2 h-2 rounded-full mr-1 ${
              realtimeStatus === 'SUBSCRIBED' ? 'bg-green-500' :
              realtimeStatus === 'CHANNEL_ERROR' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className="text-gray-500">
              {realtimeStatus === 'SUBSCRIBED' ? 'Live' :
               realtimeStatus === 'CHANNEL_ERROR' ? 'Offline' : 'Connecting'}
            </span>
          </div>
          <button
            onClick={handleEditProfile}
            className="flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Edit Profile
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete Driver
          </button>
        </div>
      </div>

      {/* Driver Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Truck className="w-8 h-8 text-green-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {getUserDisplayName(driver)}
              </h1>

              {/* Driver-specific info */}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>@{driver.username}</span>
                </div>
                {driver.email && (
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    <span>{driver.email}</span>
                  </div>
                )}
                {driver.phone_number && (
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    <span>{driver.phone_number}</span>
                  </div>
                )}
                {driver.address && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{driver.address}</span>
                  </div>
                )}
              </div>

              {/* Vehicle Information */}
              {(driver.vehicle_type || driver.vehicle_number) && (
                <div className="bg-green-50 rounded-lg p-3 mb-4">
                  <h3 className="font-medium text-green-800 mb-2 flex items-center">
                    <Truck className="w-4 h-4 mr-1" />
                    Vehicle Information
                  </h3>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {driver.vehicle_type && (
                      <div>
                        <span className="text-green-600">Type: </span>
                        <span className="font-medium text-green-800">
                          {formatVehicleType(driver.vehicle_type)}
                        </span>
                      </div>
                    )}
                    {driver.vehicle_number && (
                      <div>
                        <span className="text-green-600">Number: </span>
                        <span className="font-medium text-green-800">
                          {driver.vehicle_number}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-1" />
                <span>Joined {new Date(driver.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards - Driver Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Bids */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Bids</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalBids}</p>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-green-600 mr-1">{stats.wonAuctions} won</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-orange-600 ml-1">{stats.activeAuctions} active</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50">
                <Target className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Win Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round(stats.winRate)}%
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.wonAuctions} of {stats.totalBids} bids
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-50">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Average Bid */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Bid</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{Math.round(stats.avgBidAmount).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Competitive bidding
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Total Earnings */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Earnings</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{Math.round(stats.totalEarnings).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.completedJobs} jobs completed
                </p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Stats Bar */}
      {stats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.wonAuctions} Won</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.activeAuctions} Active</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.completedJobs} Completed</span>
              </div>
              <div className="flex items-center">
                <Zap className="w-4 h-4 text-yellow-500 mr-1" />
                <span className="text-gray-600">{stats.responsiveness}% Responsive</span>
              </div>
            </div>
            <div className="text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Preferred Vehicle Types */}
      {stats && stats.preferredVehicleTypes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Vehicle Type Preferences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.preferredVehicleTypes.map((vehicle, index) => (
              <div key={vehicle.type} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">
                    {formatVehicleType(vehicle.type)}
                  </span>
                  <span className="text-sm text-gray-500">
                    #{index + 1}
                  </span>
                </div>
                <div className="flex items-center">
                  <Truck className="w-4 h-4 text-gray-500 mr-2" />
                  <span className="text-lg font-semibold text-gray-900">
                    {vehicle.count} bids
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bidding History Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Bidding History ({bidHistory.length})
          </h2>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search auctions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="incomplete">Incomplete</option>
            </select>
          </div>
        </div>

        {/* Bidding History Table */}
        {filteredBids.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Auction
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      My Bid
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Result
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Consigner
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Job Date
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBids.map((bid) => (
                    <tr
                      key={bid.bid_id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900 mb-1">
                            {bid.title}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {bid.description}
                          </p>
                          <div className="flex items-center mt-1 text-xs text-gray-400">
                            <Truck className="w-3 h-3 mr-1" />
                            {formatVehicleType(bid.vehicle_type)}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-900">
                            ₹{bid.bid_amount.toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(bid.bid_created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {getStatusIcon(bid.status)}
                          <span className={`ml-2 ${getStatusBadge(bid.status)}`}>
                            {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-center">
                          {bid.is_winning_bid ? (
                            <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              <Trophy className="w-3 h-3 mr-1" />
                              Won
                            </span>
                          ) : bid.status === "active" ? (
                            <span className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              <XCircle className="w-3 h-3 mr-1" />
                              Lost
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {bid.consigner_username}
                          </p>
                          {bid.consigner_phone && (
                            <p className="text-sm text-gray-500 flex items-center">
                              <Phone className="w-3 h-3 mr-1" />
                              {bid.consigner_phone}
                            </p>
                          )}
                          {bid.consigner_address && (
                            <p className="text-xs text-gray-400 flex items-center mt-1">
                              <MapPin className="w-3 h-3 mr-1" />
                              {bid.consigner_address}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {new Date(bid.consignment_date).toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            {new Date(bid.consignment_date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          href={`/auctions/${bid.auction_id}`}
                          className="inline-flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {filteredBids.map((bid) => (
                <div
                  key={bid.bid_id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {bid.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {bid.description}
                      </p>
                    </div>
                    <div className="flex items-center ml-3">
                      {getStatusIcon(bid.status)}
                      <span className={`ml-2 ${getStatusBadge(bid.status)}`}>
                        {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-600">My Bid</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ₹{bid.bid_amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Result</p>
                      {bid.is_winning_bid ? (
                        <span className="inline-flex items-center text-green-700 font-semibold">
                          <Trophy className="w-3 h-3 mr-1" />
                          Won
                        </span>
                      ) : bid.status === "active" ? (
                        <span className="inline-flex items-center text-orange-600">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-gray-500">
                          <XCircle className="w-3 h-3 mr-1" />
                          Lost
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600">Vehicle Type</p>
                      <p className="text-gray-900 flex items-center">
                        <Truck className="w-3 h-3 mr-1" />
                        {formatVehicleType(bid.vehicle_type)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Job Date</p>
                      <p className="text-gray-900">
                        {new Date(bid.consignment_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Consigner: {bid.consigner_username}
                    </p>
                    {bid.consigner_phone && (
                      <p className="text-sm text-gray-600 flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {bid.consigner_phone}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Bid placed: {new Date(bid.bid_created_at).toLocaleDateString()}
                    </div>
                    <Link
                      href={`/auctions/${bid.auction_id}`}
                      className="inline-flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {bidHistory.length === 0
                ? "No bids placed yet"
                : "No bids found matching your search"}
            </p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Edit3 className="w-5 h-5 mr-2" />
                Edit Driver Profile
              </h2>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editingProfile.first_name || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          first_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editingProfile.last_name || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          last_name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Contact Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={editingProfile.email || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editingProfile.phone_number || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          phone_number: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <textarea
                      value={editingProfile.address || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          address: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter address"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Truck className="w-5 h-5 mr-2" />
                  Vehicle Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type
                    </label>
                    <select
                      value={editingProfile.vehicle_type || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          vehicle_type: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                    >
                      <option value="">Select vehicle type</option>
                      <option value="three_wheeler">3 Wheeler</option>
                      <option value="pickup_truck">Pickup Truck</option>
                      <option value="mini_truck">Mini Truck</option>
                      <option value="medium_truck">Medium Truck</option>
                      <option value="large_truck">Large Truck</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={editingProfile.vehicle_number || ""}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          vehicle_number: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                      placeholder="Enter vehicle number (e.g., AS01AB1234)"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Payment Information
                </h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    UPI ID
                  </label>
                  <input
                    type="text"
                    value={editingProfile.upi_id || ""}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        upi_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                    placeholder="Enter UPI ID (e.g., driver@paytm)"
                  />
                </div>
              </div>

              {/* Account Information (Read-only) */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Account Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Username
                    </label>
                    <input
                      type="text"
                      value={editingProfile.username}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={editingProfile.role}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                <Settings className="w-4 h-4 mr-1" />
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
              Delete Driver
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{getUserDisplayName(driver)}</span>?
              This will permanently delete the driver and all related data including:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1 list-disc list-inside">
              <li>All bids placed by this driver</li>
              <li>All notifications and audit logs</li>
              <li>Profile information</li>
              <li>Winning auction records will be cleared</li>
            </ul>
            <p className="text-red-600 text-sm font-medium text-center mb-6">
              This action cannot be undone!
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteDriver}
                disabled={deleting}
                className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}