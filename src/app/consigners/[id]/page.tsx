"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  ArrowLeft,
  Calendar,
  User,
  Package,
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
  Truck,
  BarChart3,
  Filter,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface ConsignerProfile {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  role: string;
}

interface ConsignerAuction {
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
  bid_count: number;
  lowest_bid_amount: number | null;
  highest_bid_amount: number | null;
  winner_id: string | null;
  winner_username: string | null;
  winner_phone: string | null;
  winner_vehicle_type: string | null;
}

interface ConsignerStats {
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  cancelledAuctions: number;
  incompleteAuctions: number;
  successRate: number;
  totalBidsReceived: number;
  avgBidsPerAuction: number;
  totalPotentialRevenue: number;
  avgAuctionValue: number;
}

export default function ConsignerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const consignerId = params.id as string;

  const [consigner, setConsigner] = useState<ConsignerProfile | null>(null);
  const [auctions, setAuctions] = useState<ConsignerAuction[]>([]);
  const [filteredAuctions, setFilteredAuctions] = useState<ConsignerAuction[]>([]);
  const [stats, setStats] = useState<ConsignerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string>("connecting");
  const subscriptionRef = useRef<any>(null);

  // Profile editing states
  const [editingProfile, setEditingProfile] = useState<ConsignerProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Delete states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (consignerId && isSupabaseAvailable()) {
      fetchConsignerData();
      setupRealTimeSubscriptions();
    } else if (consignerId && !isSupabaseAvailable()) {
      setLoading(false);
      setError("Supabase configuration not available");
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [consignerId]);

  useEffect(() => {
    filterAuctions();
  }, [auctions, searchTerm, statusFilter]);

  const fetchConsignerData = useCallback(async () => {
    if (!consignerId) return;

    try {
      const [consignerResult, auctionsResult] = await Promise.all([
        // Get consigner profile
        supabase
          .from("profiles")
          .select("*")
          .eq("id", consignerId)
          .eq("role", "consigner")
          .single(),

        // Get consigner auctions with winner info using the view
        supabase
          .from("consigner_auction_summary")
          .select("*")
          .eq("created_by", consignerId)
          .order("created_at", { ascending: false }),
      ]);

      if (consignerResult.error) {
        if (consignerResult.error.code === "PGRST116") {
          throw new Error("Consigner not found");
        }
        throw consignerResult.error;
      }
      if (auctionsResult.error) throw auctionsResult.error;

      const consignerData = consignerResult.data;
      const auctionsData = auctionsResult.data || [];

      setConsigner(consignerData);
      setAuctions(auctionsData);

      // Calculate statistics
      const stats = calculateStats(auctionsData);
      setStats(stats);
    } catch (err: any) {
      console.error("Error fetching consigner data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [consignerId]);

  const setupRealTimeSubscriptions = useCallback(() => {
    if (!consignerId) return;

    console.log("Setting up real-time subscriptions for consigner:", consignerId);

    const channel = supabase
      .channel(`consigner_${consignerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
          filter: `created_by=eq.${consignerId}`,
        },
        (payload) => {
          console.log("Consigner auction change detected:", payload);
          fetchConsignerData();
        }
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
          // Refresh to get updated bid counts
          fetchConsignerData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${consignerId}`,
        },
        (payload) => {
          console.log("Consigner profile change detected:", payload);
          fetchConsignerData();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        setRealtimeStatus(status);
      });

    subscriptionRef.current = channel;
  }, [consignerId, fetchConsignerData]);

  const calculateStats = (auctionsData: ConsignerAuction[]): ConsignerStats => {
    const totalAuctions = auctionsData.length;
    const activeAuctions = auctionsData.filter((a) => a.status === "active").length;
    const completedAuctions = auctionsData.filter((a) => a.status === "completed").length;
    const cancelledAuctions = auctionsData.filter((a) => a.status === "cancelled").length;
    const incompleteAuctions = auctionsData.filter((a) => a.status === "incomplete").length;

    const successRate = totalAuctions > 0 ? (completedAuctions / totalAuctions) * 100 : 0;
    const totalBidsReceived = auctionsData.reduce((sum, a) => sum + (a.bid_count || 0), 0);
    const avgBidsPerAuction = totalAuctions > 0 ? totalBidsReceived / totalAuctions : 0;

    // Calculate potential revenue (from lowest bids as drivers bid lowest to win)
    const totalPotentialRevenue = auctionsData
      .filter((a) => a.lowest_bid_amount !== null)
      .reduce((sum, a) => sum + (a.lowest_bid_amount || 0), 0);

    const avgAuctionValue = completedAuctions > 0
      ? auctionsData
          .filter((a) => a.status === "completed" && a.lowest_bid_amount !== null)
          .reduce((sum, a) => sum + (a.lowest_bid_amount || 0), 0) / completedAuctions
      : 0;

    return {
      totalAuctions,
      activeAuctions,
      completedAuctions,
      cancelledAuctions,
      incompleteAuctions,
      successRate,
      totalBidsReceived,
      avgBidsPerAuction,
      totalPotentialRevenue,
      avgAuctionValue,
    };
  };

  const filterAuctions = () => {
    let filtered = [...auctions];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((auction) => auction.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (auction) =>
          auction.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          auction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          auction.vehicle_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

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

  const getUserDisplayName = (consigner: ConsignerProfile | null) => {
    if (!consigner) return "Unknown Consigner";
    if (consigner.first_name || consigner.last_name) {
      return `${consigner.first_name || ""} ${consigner.last_name || ""}`.trim();
    }
    return consigner.username || "Unknown Consigner";
  };

  const handleEditProfile = () => {
    if (consigner) {
      setEditingProfile({ ...consigner });
      setShowEditProfile(true);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingProfile || !consigner) return;

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
          updated_at: new Date().toISOString(),
        })
        .eq("id", consigner.id);

      if (error) throw error;

      // Refresh consigner data
      await fetchConsignerData();
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

  const handleDeleteConsigner = async () => {
    if (!consigner) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/delete-consigner?id=${consigner.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete consigner");
      }

      // Redirect to consigners list after successful deletion
      router.push("/consigners");
    } catch (err: any) {
      console.error("Error deleting consigner:", err);
      setError("Failed to delete consigner: " + err.message);
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
            href="/consigners"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Consigners
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Error loading consigner details: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!consigner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/consigners"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Consigners
          </Link>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Consigner not found
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
            href="/consigners"
            className="flex items-center text-indigo-600 hover:text-indigo-700 mt-1"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Consigners
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
            Delete Consigner
          </button>
        </div>
      </div>

      {/* Consigner Info Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {getUserDisplayName(consigner)}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-1" />
                  <span>@{consigner.username}</span>
                </div>
                {consigner.email && (
                  <div className="flex items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    <span>{consigner.email}</span>
                  </div>
                )}
                {consigner.phone_number && (
                  <div className="flex items-center">
                    <Phone className="w-4 h-4 mr-1" />
                    <span>{consigner.phone_number}</span>
                  </div>
                )}
                {consigner.address && (
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    <span>{consigner.address}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <Calendar className="w-4 h-4 mr-1" />
                <span>Joined {new Date(consigner.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards - Key Metrics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Auctions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Auctions</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalAuctions}</p>
                <div className="flex items-center mt-2 text-sm">
                  <span className="text-green-600 mr-1">{stats.activeAuctions} active</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-blue-600 ml-1">{stats.completedAuctions} completed</span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-blue-50">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Success Rate</p>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round(stats.successRate)}%
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.completedAuctions} of {stats.totalAuctions} completed
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-50">
                <Trophy className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Total Bids Received */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Bids</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalBidsReceived}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Avg {Math.round(stats.avgBidsPerAuction * 10) / 10} per auction
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-50">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          {/* Average Revenue */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Avg Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{Math.round(stats.avgAuctionValue).toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Total: ₹{Math.round(stats.totalPotentialRevenue).toLocaleString()}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-50">
                <DollarSign className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      {stats && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.activeAuctions} Active</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.completedAuctions} Completed</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.cancelledAuctions} Cancelled</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-gray-600">{stats.incompleteAuctions} Incomplete</span>
              </div>
            </div>
            <div className="text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      )}

      {/* Auctions Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Auctions ({auctions.length})
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

        {/* Auctions Table */}
        {filteredAuctions.length > 0 ? (
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
                      Vehicle Type
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Bids
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Best Bid
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Winner
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
                  {filteredAuctions.map((auction) => (
                    <tr
                      key={auction.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900 mb-1">
                            {auction.title}
                          </p>
                          <p className="text-sm text-gray-500 line-clamp-2">
                            {auction.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Created: {new Date(auction.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <Truck className="w-4 h-4 mr-2 text-gray-500" />
                          <span className="text-sm text-gray-900">
                            {formatVehicleType(auction.vehicle_type)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          {getStatusIcon(auction.status)}
                          <span className={`ml-2 ${getStatusBadge(auction.status)}`}>
                            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-center">
                          <p className="font-semibold text-gray-900">
                            {auction.bid_count || 0}
                          </p>
                          <p className="text-sm text-gray-500">bids</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          {auction.lowest_bid_amount ? (
                            <div>
                              <p className="font-semibold text-green-700">
                                ₹{auction.lowest_bid_amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                Range: ₹{auction.lowest_bid_amount.toLocaleString()} - ₹{auction.highest_bid_amount?.toLocaleString() || 0}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">No bids</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {auction.winner_username ? (
                          <div>
                            <p className="font-medium text-gray-900 flex items-center">
                              <Trophy className="w-3 h-3 mr-1 text-yellow-600" />
                              {auction.winner_username}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatVehicleType(auction.winner_vehicle_type || "")}
                            </p>
                            {auction.winner_phone && (
                              <p className="text-xs text-gray-400">
                                {auction.winner_phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {new Date(auction.consignment_date).toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            {new Date(auction.consignment_date).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          href={`/auctions/${auction.id}`}
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
              {filteredAuctions.map((auction) => (
                <div
                  key={auction.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {auction.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2">
                        {auction.description}
                      </p>
                    </div>
                    <div className="flex items-center ml-3">
                      {getStatusIcon(auction.status)}
                      <span className={`ml-2 ${getStatusBadge(auction.status)}`}>
                        {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-600">Vehicle Type</p>
                      <p className="text-gray-900 flex items-center">
                        <Truck className="w-3 h-3 mr-1" />
                        {formatVehicleType(auction.vehicle_type)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Bids</p>
                      <p className="text-gray-900 font-semibold">
                        {auction.bid_count || 0} bids
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Best Bid</p>
                      {auction.lowest_bid_amount ? (
                        <p className="text-green-700 font-semibold">
                          ₹{auction.lowest_bid_amount.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-gray-400">No bids</p>
                      )}
                    </div>
                    <div>
                      <p className="text-gray-600">Job Date</p>
                      <p className="text-gray-900">
                        {new Date(auction.consignment_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {auction.winner_username && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-sm font-medium text-green-800 flex items-center">
                        <Trophy className="w-4 h-4 mr-1" />
                        Winner: {auction.winner_username}
                      </p>
                      <p className="text-sm text-green-600">
                        {formatVehicleType(auction.winner_vehicle_type || "")}
                        {auction.winner_phone && ` • ${auction.winner_phone}`}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      Created: {new Date(auction.created_at).toLocaleDateString()}
                    </div>
                    <Link
                      href={`/auctions/${auction.id}`}
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
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              {auctions.length === 0
                ? "No auctions created yet"
                : "No auctions found matching your search"}
            </p>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {showEditProfile && editingProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Edit3 className="w-5 h-5 mr-2" />
                Edit Consigner Profile
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
              Delete Consigner
            </h2>
            <p className="text-gray-600 text-center mb-6">
              Are you sure you want to delete{" "}
              <span className="font-semibold">{getUserDisplayName(consigner)}</span>?
              This will permanently delete the consigner and all related data including:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1 list-disc list-inside">
              <li>All auctions created by this consigner</li>
              <li>All bids received on their auctions</li>
              <li>All notifications and audit logs</li>
              <li>Profile information</li>
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
                onClick={handleDeleteConsigner}
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