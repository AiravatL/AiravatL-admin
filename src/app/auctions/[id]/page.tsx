"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, supabaseAdmin, isSupabaseAvailable, isSupabaseAdminAvailable } from "@/lib/supabase";
import {
  ArrowLeft,
  Calendar,
  User,
  Truck,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  Package,
  Activity,
  TrendingDown,
  TrendingUp,
  Trophy,
  Settings,
  Save,
  RotateCcw,
  X,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface AuctionDetail {
  id: string;
  title: string;
  description: string;
  vehicle_type: string;
  start_time: string;
  end_time: string;
  consignment_date: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  estimated_distance: number | null;
  weight: number | null;
  cargo_type: string | null;
  status: "active" | "completed" | "cancelled" | "incomplete";
  created_by: string;
  winner_id: string | null;
  winning_bid_id: string | null;
  created_at: string;
  updated_at: string;
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
    vehicle_type: string | null;
    phone_number: string | null;
  };
  winning_bid?: {
    id: string;
    amount: string;
    created_at: string;
  };
}

interface Bid {
  id: string;
  auction_id: string;
  user_id: string;
  amount: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    vehicle_number: string | null;
    vehicle_type: string | null;
    phone_number: string | null;
  };
}

interface AuditLog {
  id: string;
  auction_id: string;
  user_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user?: {
    username: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function AuctionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id as string;

  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusManager, setShowStatusManager] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingBid, setDeletingBid] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<string>('connecting');
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (auctionId && isSupabaseAvailable()) {
      fetchAuctionDetails();
      setupRealTimeSubscriptions();
    } else if (auctionId && !isSupabaseAvailable()) {
      setLoading(false);
      setError("Supabase configuration not available");
    }

    // Cleanup subscriptions on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [auctionId]);

  useEffect(() => {
    if (auction) {
      setSelectedStatus(auction.status);
    }
  }, [auction]);

  const fetchAuctionDetails = useCallback(async () => {
    if (!auctionId) return;
    
    try {
      // Use a single optimized query with proper joins
      const [auctionResult, bidsResult] = await Promise.all([
        // Fetch auction with all related data in one query
        supabase
          .from("auctions")
          .select(`
            *,
            profiles!auctions_created_by_fkey (
              id, username, first_name, last_name, email, phone_number
            ),
            winner:profiles!auctions_winner_id_fkey (
              id, username, first_name, last_name, vehicle_number, vehicle_type, phone_number
            ),
            winning_bid:auction_bids!auctions_winning_bid_id_fkey (
              id, amount, created_at
            )
          `)
          .eq("id", auctionId)
          .single(),

        // Fetch all bids with user data
        supabase
          .from("auction_bids")
          .select(`
            *,
            profiles!auction_bids_user_id_fkey (
              id, username, first_name, last_name, vehicle_number, vehicle_type, phone_number
            )
          `)
          .eq("auction_id", auctionId)
          .order("amount", { ascending: true })
      ]);

      if (auctionResult.error) throw auctionResult.error;
      if (bidsResult.error) throw bidsResult.error;

      const auctionData = auctionResult.data;
      const bidsData = bidsResult.data || [];

      if (!auctionData) {
        throw new Error("Auction not found");
      }

      setAuction({
        ...auctionData,
        consigner: auctionData.profiles,
        winner: auctionData.winner,
        winning_bid: auctionData.winning_bid,
      });

      setBids(bidsData.map((bid) => ({ ...bid, user: bid.profiles || {} })));
      
    } catch (err: any) {
      console.error("Error fetching auction details:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  const setupRealTimeSubscriptions = useCallback(() => {
    if (!auctionId) return;

    console.log("Setting up real-time subscriptions for auction:", auctionId);

    // Create a channel for this auction
    const channel = supabase
      .channel(`auction_${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_bids',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          console.log('Bid change detected:', payload);
          // Refresh bids when any bid is inserted, updated, or deleted
          fetchAuctionDetails();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'auctions',
          filter: `id=eq.${auctionId}`,
        },
        (payload) => {
          console.log('Auction change detected:', payload);
          // Refresh auction when status or winner changes
          fetchAuctionDetails();
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setRealtimeStatus(status);
      });

    subscriptionRef.current = channel;
  }, [auctionId, fetchAuctionDetails]);

  const formatVehicleType = (type: string) => {
    return type
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <Clock className="w-5 h-5 text-green-600" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
      case "cancelled":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "incomplete":
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800 border-green-200",
      completed: "bg-blue-100 text-blue-800 border-blue-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      incomplete: "bg-yellow-100 text-yellow-800 border-yellow-200",
    };
    return `px-3 py-1 rounded-full text-sm font-medium border ${
      styles[status as keyof typeof styles] ||
      "bg-gray-100 text-gray-800 border-gray-200"
    }`;
  };

  const getUserDisplayName = (user: any) => {
    if (user?.first_name || user?.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    return user?.username || "Unknown User";
  };

  const getBidTrend = (currentBid: Bid, index: number) => {
    if (index === bids.length - 1) return null;
    const nextBid = bids[index + 1];
    const currentAmount = parseFloat(currentBid.amount);
    const nextAmount = parseFloat(nextBid.amount);

    if (currentAmount < nextAmount) {
      return <TrendingDown className="w-4 h-4 text-green-600" />;
    } else if (currentAmount > nextAmount) {
      return <TrendingUp className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

  const updateAuctionStatus = async () => {
    if (!auction || selectedStatus === auction.status) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("auctions")
        .update({
          status: selectedStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auctionId);

      if (error) throw error;

      // Create audit log
      await supabase.from("auction_audit_logs").insert({
        auction_id: auctionId,
        user_id: null, // Admin user - could be improved to track admin user
        action: `Status changed from ${auction.status} to ${selectedStatus}`,
        details: {
          previous_status: auction.status,
          new_status: selectedStatus,
          changed_by: "admin",
        },
      });

      // Refresh auction data
      await fetchAuctionDetails();
      setShowStatusManager(false);
    } catch (err: any) {
      console.error("Error updating auction status:", err);
      setError("Failed to update auction status: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const resetStatusChanges = () => {
    if (auction) {
      setSelectedStatus(auction.status);
    }
    setShowStatusManager(false);
  };

  const deleteBid = async (bidId: string) => {
    if (!bidId) return;

    setDeletingBid(true);
    try {
      console.log("Attempting to delete bid via API:", bidId);

      // Call the admin API endpoint to delete the bid
      const response = await fetch('/api/admin/delete-bid', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidId: bidId,
          auctionId: auctionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage = result.error || 'Failed to delete bid';
        const errorDetails = result.details || '';
        console.error("Bid deletion failed:", { status: response.status, error: errorMessage, details: errorDetails });
        throw new Error(`${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`);
      }

      console.log("Bid deletion API response:", result);

      // Close the confirmation modal 
      setShowDeleteConfirm(null);
      
      // Clear any previous errors
      setError(null);
      
      // Force refresh if real-time isn't working
      setTimeout(() => {
        fetchAuctionDetails();
      }, 1000);
      
      // Show success message
      console.log("Bid deletion completed successfully:", result.message);

    } catch (err: any) {
      console.error("Error deleting bid:", err);
      setError("Failed to delete bid: " + err.message);
    } finally {
      setDeletingBid(false);
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
            href="/auctions"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Auctions
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Error loading auction details: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/auctions"
            className="flex items-center text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Auctions
          </Link>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            Auction not found
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/auctions"
          className="flex items-center text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Auctions
        </Link>
        <div className="flex items-center space-x-3">
          {getStatusIcon(auction.status)}
          <span className={getStatusBadge(auction.status)}>
            {auction.status?.charAt(0).toUpperCase() + auction.status?.slice(1)}
          </span>
          <button
            onClick={() => setShowStatusManager(true)}
            className="flex items-center px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4 mr-1" />
            Manage Status
          </button>
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
        </div>
      </div>

      {/* Status Management Modal */}
      {showStatusManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Manage Auction Status
              </h2>
              <button
                onClick={resetStatusChanges}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Status
                </label>
                <div className="flex items-center">
                  {getStatusIcon(auction.status)}
                  <span className={`ml-2 ${getStatusBadge(auction.status)}`}>
                    {auction.status?.charAt(0).toUpperCase() +
                      auction.status?.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Change Status To
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white"
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>

              {selectedStatus !== auction.status && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
                    <span className="text-sm text-yellow-700">
                      This will change the auction status from{" "}
                      <strong>{auction.status}</strong> to{" "}
                      <strong>{selectedStatus}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetStatusChanges}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                Cancel
              </button>
              <button
                onClick={updateAuctionStatus}
                disabled={updating || selectedStatus === auction.status}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                <Save className="w-4 h-4 mr-1" />
                {updating ? "Updating..." : "Update Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Bid Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Trash2 className="w-5 h-5 mr-2 text-red-600" />
                Delete Bid
              </h2>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <span className="text-sm text-red-700">
                    This action cannot be undone. The bid will be permanently removed from the auction.
                  </span>
                </div>
              </div>

              {(() => {
                const bid = bids.find(b => b.id === showDeleteConfirm);
                const isWinningBid = auction?.winning_bid_id === showDeleteConfirm;
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Bid Details:</p>
                      <p className="text-gray-900">
                        ₹{bid ? parseFloat(bid.amount).toLocaleString() : 'N/A'} by{' '}
                        {bid?.user?.username || 'Unknown User'}
                      </p>
                    </div>
                    
                    {isWinningBid && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <Trophy className="w-4 h-4 text-yellow-600 mr-2" />
                          <span className="text-sm text-yellow-700">
                            This is the winning bid. Deleting it will remove the auction winner.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteBid(showDeleteConfirm)}
                disabled={deletingBid}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {deletingBid ? "Deleting..." : "Delete Bid"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auction Title & Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {auction.title}
            </h1>
            <p className="text-gray-600 mb-4">{auction.description}</p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                <span>
                  Created: {new Date(auction.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>Ends: {new Date(auction.end_time).toLocaleString()}</span>
              </div>
              <div className="flex items-center">
                <Truck className="w-4 h-4 mr-1" />
                <span>
                  Job Date:{" "}
                  {new Date(auction.consignment_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="ml-6">
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {formatVehicleType(auction.vehicle_type)}
            </span>
          </div>
        </div>
      </div>

      {/* Key Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Consigner Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Consigner</h3>
            <User className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <p className="font-medium text-gray-900">
              {getUserDisplayName(auction.consigner)}
            </p>
            <p className="text-sm text-gray-500">
              @{auction.consigner?.username}
            </p>
            {auction.consigner?.email && (
              <p className="text-sm text-gray-600">{auction.consigner.email}</p>
            )}
            {auction.consigner?.phone_number && (
              <p className="text-sm text-gray-600">
                {auction.consigner.phone_number}
              </p>
            )}
          </div>
        </div>

        {/* Winner Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Winner</h3>
            <Trophy className="w-5 h-5 text-yellow-600" />
          </div>
          {auction.winner ? (
            <div className="space-y-2">
              <p className="font-medium text-green-700">
                {getUserDisplayName(auction.winner)}
              </p>
              <p className="text-sm text-gray-500">
                @{auction.winner.username}
              </p>
              {auction.winner.vehicle_number && (
                <p className="text-sm text-gray-600">
                  {auction.winner.vehicle_number}
                </p>
              )}
              {auction.winner.phone_number && (
                <p className="text-sm text-gray-600">
                  {auction.winner.phone_number}
                </p>
              )}
              {auction.winning_bid && (
                <p className="text-lg font-bold text-green-700">
                  ₹{parseFloat(auction.winning_bid.amount).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400">No winner yet</p>
          )}
        </div>

        {/* Bid Statistics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Bid Stats</h3>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Bids</p>
              <p className="text-2xl font-bold text-gray-900">{bids.length}</p>
            </div>
            {bids.length > 0 && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Lowest Bid</p>
                  <p className="text-lg font-semibold text-green-700">
                    ₹
                    {Math.min(
                      ...bids.map((b) => parseFloat(b.amount))
                    ).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Highest Bid</p>
                  <p className="text-lg font-semibold text-red-700">
                    ₹
                    {Math.max(
                      ...bids.map((b) => parseFloat(b.amount))
                    ).toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Job Details</h3>
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div className="space-y-2">
            {auction.pickup_location && (
              <div>
                <p className="text-sm text-gray-600">Pickup</p>
                <p className="text-sm font-medium text-gray-900 flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {auction.pickup_location}
                </p>
              </div>
            )}
            {auction.dropoff_location && (
              <div>
                <p className="text-sm text-gray-600">Drop-off</p>
                <p className="text-sm font-medium text-gray-900 flex items-center">
                  <MapPin className="w-3 h-3 mr-1" />
                  {auction.dropoff_location}
                </p>
              </div>
            )}
            {auction.estimated_distance && (
              <div>
                <p className="text-sm text-gray-600">Distance</p>
                <p className="text-sm font-medium text-gray-900">
                  {auction.estimated_distance} km
                </p>
              </div>
            )}
            {auction.weight && (
              <div>
                <p className="text-sm text-gray-600">Weight</p>
                <p className="text-sm font-medium text-gray-900">
                  {auction.weight} kg
                </p>
              </div>
            )}
            {auction.cargo_type && (
              <div>
                <p className="text-sm text-gray-600">Cargo Type</p>
                <p className="text-sm font-medium text-gray-900">
                  {auction.cargo_type}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bid History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Bid History ({bids.length} bids)
          </h2>
        </div>

        {bids.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Bidder
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Vehicle
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Phone
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Time
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Trend
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bids.map((bid, index) => (
                    <tr
                      key={bid.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">
                            {getUserDisplayName(bid.user)}
                          </p>
                          <p className="text-sm text-gray-500">
                            @{bid.user?.username}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-lg font-semibold text-gray-900">
                          ₹{parseFloat(bid.amount).toLocaleString()}
                        </p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {formatVehicleType(bid.user?.vehicle_type || "")}
                          </p>
                          <p className="text-gray-500">
                            {bid.user?.vehicle_number}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          {bid.user?.phone_number ? (
                            <p className="text-gray-900">
                              {bid.user.phone_number}
                            </p>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {new Date(bid.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            {new Date(bid.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">{getBidTrend(bid, index)}</td>
                      <td className="py-4 px-4">
                        {auction.winner_id === bid.user_id ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center w-fit">
                            <Trophy className="w-3 h-3 mr-1" />
                            Winner
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={() => setShowDeleteConfirm(bid.id)}
                          className="inline-flex items-center px-2 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                          title="Delete Bid"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {bids.map((bid, index) => (
                <div
                  key={bid.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">
                        {getUserDisplayName(bid.user)}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{bid.user?.username}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getBidTrend(bid, index)}
                      {auction.winner_id === bid.user_id && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
                          <Trophy className="w-3 h-3 mr-1" />
                          Winner
                        </span>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(bid.id)}
                        className="inline-flex items-center px-2 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition-colors"
                        title="Delete Bid"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Amount</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ₹{parseFloat(bid.amount).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Vehicle</p>
                      <p className="text-gray-900">
                        {formatVehicleType(bid.user?.vehicle_type || "")}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {bid.user?.vehicle_number}
                      </p>
                    </div>
                  </div>
                  
                  {bid.user?.phone_number && (
                    <div className="mt-3 text-sm">
                      <p className="text-gray-600">Phone</p>
                      <p className="text-gray-900">{bid.user.phone_number}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-xs text-gray-600">
                      <p>
                        {new Date(bid.created_at).toLocaleDateString()} at{" "}
                        {new Date(bid.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No bids placed yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
