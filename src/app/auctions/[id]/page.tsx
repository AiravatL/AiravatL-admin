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
  Trophy,
  Settings,
  Save,
  RotateCcw,
  X,
  Trash2,
  Edit3,
  Check,
  Weight,
  Ruler,
  Users,
} from "lucide-react";
import Link from "next/link";

// Vehicle type mappings from the Expo app
const VEHICLE_TYPES = [
  { id: "three_wheeler", title: "Three Wheeler", icon: "🛺", capacity: "Up to 200kg" },
  { id: "pickup_truck", title: "Pickup Truck", icon: "🚙", capacity: "Up to 1000kg" },
  { id: "mini_truck", title: "Mini Truck", icon: "🚐", capacity: "Up to 2000kg" },
  { id: "medium_truck", title: "Medium Truck", icon: "🚚", capacity: "Up to 5000kg" },
  { id: "large_truck", title: "Large Truck", icon: "🚛", capacity: "Up to 10000kg" },
];

const BODY_TYPES = [
  { id: "container", title: "Container", icon: "📦", description: "Fully enclosed container" },
  { id: "top_open", title: "Top Open", icon: "📤", description: "Open top for easy loading" },
  { id: "trailer", title: "Trailer", icon: "🚛", description: "Large trailer for heavy cargo" },
];

const WHEEL_TYPES = [
  { value: 4, label: "4 Wheeler", icon: "🚗" },
  { value: 6, label: "6 Wheeler", icon: "🚚" },
  { value: 10, label: "10 Wheeler", icon: "🚛" },
  { value: 12, label: "12 Wheeler", icon: "🚛" },
  { value: 14, label: "14 Wheeler", icon: "🚛" },
  { value: 18, label: "18 Wheeler", icon: "🚛" },
];

interface ParsedAuctionData {
  pickup: string;
  dropoff: string;
  description: string;
  weight: string;
  weightUnit: string;
  vehicleType: string;
  lengthValue?: string;
  lengthUnit?: string;
  bodyType?: string;
  wheelType?: number;
  consignmentDate: string;
  endTime: string;
}

interface AuctionDetail {
  id: string;
  title: string;
  description: string;
  vehicle_type: string;
  start_time: string;
  end_time: string;
  consignment_date: string;
  length_value: number | null;
  length_unit: string | null;
  body_type: string | null;
  wheel_type: number | null;
  bid_count: number | null;
  lowest_bid_amount: number | null;
  highest_bid_amount: number | null;
  status: "active" | "completed" | "cancelled" | "incomplete";
  created_by: string;
  winner_id: string | null;
  winning_bid_id: string | null;
  created_at: string;
  updated_at: string;
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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const [isRealTimeConnected, setIsRealTimeConnected] = useState(false);
  const [backgroundUpdateCount, setBackgroundUpdateCount] = useState(0);
  const [isPollingActive, setIsPollingActive] = useState(false);
  const lastActiveTimeRef = useRef<Date>(new Date());
  const isPageVisibleRef = useRef<boolean>(true);

  // Edit states
  const [editingAuction, setEditingAuction] = useState(false);
  const [editedData, setEditedData] = useState<ParsedAuctionData>({
    pickup: "",
    dropoff: "",
    description: "",
    weight: "",
    weightUnit: "kg",
    vehicleType: "",
    lengthValue: "",
    lengthUnit: "meter",
    bodyType: "top_open",
    wheelType: 4,
    consignmentDate: "",
    endTime: "",
  });
  const [updatingAuction, setUpdatingAuction] = useState(false);
  const [editingBid, setEditingBid] = useState<string | null>(null);
  const [editedBidAmount, setEditedBidAmount] = useState('');
  const [updatingBid, setUpdatingBid] = useState(false);

  // Parse auction data from title and description
  const parseAuctionData = useCallback((auction: AuctionDetail): ParsedAuctionData => {
    // Parse title: "Delivery from {pickup} to {dropoff}"
    const titleMatch = auction.title.match(/Delivery from (.+) to (.+)/);
    const pickup = titleMatch ? titleMatch[1] : "";
    const dropoff = titleMatch ? titleMatch[2] : "";

    // Parse description for weight, vehicle type, etc.
    const description = auction.description;
    const lines = description.split('\n');

    let cleanDescription = "";
    let weight = "";
    let weightUnit = "kg";
    let vehicleType = auction.vehicle_type;

    for (const line of lines) {
      if (line.startsWith('Weight: ')) {
        const weightMatch = line.match(/Weight: ([\d.]+)\s*(kg|ton)/);
        if (weightMatch) {
          weight = weightMatch[1];
          weightUnit = weightMatch[2];
        }
      } else if (line.startsWith('Vehicle Type: ')) {
        // Vehicle type is already in the database field
        continue;
      } else if (line.startsWith('Length: ')) {
        // Already handled by database fields
        continue;
      } else if (line.startsWith('Body Type: ')) {
        // Already handled by database fields
        continue;
      } else if (line.startsWith('Wheel Type: ')) {
        // Already handled by database fields
        continue;
      } else if (line.trim()) {
        cleanDescription += (cleanDescription ? '\n' : '') + line;
      }
    }

    return {
      pickup,
      dropoff,
      description: cleanDescription,
      weight,
      weightUnit,
      vehicleType,
      lengthValue: auction.length_value?.toString() || "",
      lengthUnit: auction.length_unit || "meter",
      bodyType: auction.body_type || "top_open",
      wheelType: auction.wheel_type || 4,
      consignmentDate: auction.consignment_date,
      endTime: auction.end_time,
    };
  }, []);

  useEffect(() => {
    if (auctionId && isSupabaseAvailable()) {
      fetchAuctionDetails();
      setupRealTimeSubscriptions();
      setupSmartPolling();
      setupPageVisibilityListener();
    } else if (auctionId && !isSupabaseAvailable()) {
      setLoading(false);
      setError("Supabase configuration not available");
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [auctionId]);

  useEffect(() => {
    if (auction) {
      setSelectedStatus(auction.status);
      const parsedData = parseAuctionData(auction);
      setEditedData(parsedData);
    }
  }, [auction, parseAuctionData]);

  const fetchAuctionDetails = useCallback(async (isBackgroundUpdate = false) => {
    if (!auctionId) return;

    try {
      if (isBackgroundUpdate) {
        setBackgroundUpdateCount(prev => prev + 1);
      } else {
        setLoading(true);
      }
      const [auctionResult, bidsResult] = await Promise.all([
        supabase
          .from("auctions")
          .select(`
            id, title, description, vehicle_type, start_time, end_time, consignment_date,
            length_value, length_unit, body_type, wheel_type, status, created_by,
            winner_id, winning_bid_id, created_at, updated_at, bid_count,
            lowest_bid_amount, highest_bid_amount,
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

        supabase
          .from("auction_bids")
          .select(`
            id, auction_id, user_id, amount, is_winning_bid, created_at,
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
      setLastUpdateTime(new Date());

    } catch (err: any) {
      console.error("Error fetching auction details:", err);
      setError(err.message);
      setIsRealTimeConnected(false);
    } finally {
      if (!isBackgroundUpdate) {
        setLoading(false);
      }
    }
  }, [auctionId]);

  const setupRealTimeSubscriptions = useCallback(() => {
    if (!auctionId) return;

    console.log(`Setting up real-time subscriptions for auction ${auctionId}`);

    const channel = supabase
      .channel(`critical_auction_${auctionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_bids',
          filter: `auction_id=eq.${auctionId}`,
        },
        (payload) => {
          console.log('Bid change detected for auction:', payload);
          fetchAuctionDetails(true);
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
          // Only refresh for important changes (status, winner, timing)
          if (payload.new?.status !== payload.old?.status ||
              payload.new?.winner_id !== payload.old?.winner_id ||
              payload.new?.end_time !== payload.old?.end_time) {
            fetchAuctionDetails(true);
          }
        }
      )
      .subscribe((status) => {
        console.log('Auction detail subscription status:', status);
        setRealtimeStatus(status);
        setIsRealTimeConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;
  }, [auctionId, fetchAuctionDetails]);

  const setupSmartPolling = useCallback(() => {
    if (!auctionId) return;

    console.log(`Setting up smart polling for auction ${auctionId}`);

    const startPolling = () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }

      // Dynamic polling interval based on auction activity and page visibility
      const getPollingInterval = () => {
        const now = new Date();
        const timeSinceLastActive = now.getTime() - lastActiveTimeRef.current.getTime();

        // If page is not visible, poll less frequently
        if (!isPageVisibleRef.current) {
          return 300000; // 5 minutes when not visible
        }

        // For auction detail page, poll more frequently since users are actively monitoring
        if (auction?.status === 'active') {
          // Active auction - more frequent updates
          if (timeSinceLastActive > 300000) {
            return 60000; // 1 minute for inactive users on active auctions
          }
          return 15000; // 15 seconds for active users on active auctions
        } else {
          // Completed/cancelled auctions - less frequent updates
          if (timeSinceLastActive > 300000) {
            return 300000; // 5 minutes for inactive users
          }
          return 60000; // 1 minute for active users on inactive auctions
        }
      };

      const poll = () => {
        if (isSupabaseAvailable() && isPageVisibleRef.current && auctionId) {
          fetchAuctionDetails(true);
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
  }, [auctionId, auction?.status, fetchAuctionDetails]);

  const setupPageVisibilityListener = useCallback(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;

      if (isPageVisibleRef.current) {
        // Page became visible - update data immediately and reset active time
        lastActiveTimeRef.current = new Date();
        fetchAuctionDetails(true);
      }
    };

    const handleUserActivity = () => {
      lastActiveTimeRef.current = new Date();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('mousedown', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousedown', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
    };
  }, [fetchAuctionDetails]);

  const formatVehicleType = (type: string) => {
    const vehicleType = VEHICLE_TYPES.find(v => v.id === type);
    return vehicleType ? vehicleType.title : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getVehicleIcon = (type: string) => {
    const vehicleType = VEHICLE_TYPES.find(v => v.id === type);
    return vehicleType ? vehicleType.icon : "🚚";
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

  const startEditingAuction = () => {
    setEditingAuction(true);
  };

  const cancelEditingAuction = () => {
    if (auction) {
      const parsedData = parseAuctionData(auction);
      setEditedData(parsedData);
    }
    setEditingAuction(false);
  };

  const saveAuctionChanges = async () => {
    if (!auction) return;

    // Validation
    const errors = [];
    if (!editedData.pickup.trim()) errors.push('Pickup location is required');
    if (!editedData.dropoff.trim()) errors.push('Dropoff location is required');
    if (!editedData.description.trim()) errors.push('Description is required');
    if (!editedData.weight.trim()) errors.push('Weight is required');
    if (!editedData.vehicleType) errors.push('Vehicle type is required');
    if (!editedData.consignmentDate) errors.push('Consignment date is required');
    if (!editedData.endTime) errors.push('Auction end time is required');

    const weightNum = parseFloat(editedData.weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.push('Please enter a valid weight');
    }

    // Validate dates - compare dates only for admin flexibility
    const consignmentDate = new Date(editedData.consignmentDate);
    const endTime = new Date(editedData.endTime);
    const now = new Date();

    // Compare dates only (not times) for past validation to allow admin flexibility
    const consignmentDateOnly = new Date(consignmentDate.getFullYear(), consignmentDate.getMonth(), consignmentDate.getDate());
    const endDateOnly = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (consignmentDateOnly < todayOnly) {
      errors.push('Consignment date cannot be in the past');
    }

    if (endDateOnly < todayOnly) {
      errors.push('Auction end time cannot be in the past');
    }

    // Compare only dates, not times - auction should end before or on consignment date
    if (endDateOnly > consignmentDateOnly) {
      errors.push('Auction must end before or on the consignment date');
    }

    if (errors.length > 0) {
      setError('Validation errors: ' + errors.join(', '));
      return;
    }

    setUpdatingAuction(true);
    try {
      // Reconstruct title and description
      const newTitle = `Delivery from ${editedData.pickup} to ${editedData.dropoff}`;
      let newDescription = editedData.description;
      newDescription += `\nWeight: ${editedData.weight} ${editedData.weightUnit}`;
      newDescription += `\nVehicle Type: ${formatVehicleType(editedData.vehicleType)}`;

      if (editedData.lengthValue) {
        newDescription += `\nLength: ${editedData.lengthValue} ${editedData.lengthUnit}`;
      }

      if (editedData.bodyType !== "top_open") {
        const bodyType = BODY_TYPES.find(bt => bt.id === editedData.bodyType);
        newDescription += `\nBody Type: ${bodyType?.title || editedData.bodyType}`;
      }

      if (editedData.vehicleType === "large_truck" && editedData.wheelType !== 4) {
        newDescription += `\nWheel Type: ${editedData.wheelType} Wheeler`;
      }

      const response = await fetch('/api/admin/update-auction', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: auction.id,
          updates: {
            title: newTitle,
            description: newDescription,
            vehicle_type: editedData.vehicleType,
            length_value: editedData.lengthValue ? parseFloat(editedData.lengthValue) : null,
            length_unit: editedData.lengthUnit,
            body_type: editedData.bodyType,
            wheel_type: editedData.vehicleType === "large_truck" ? editedData.wheelType : null,
            consignment_date: editedData.consignmentDate,
            end_time: editedData.endTime,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update auction');
      }

      await fetchAuctionDetails();
      setEditingAuction(false);
      setError(null);

    } catch (err: any) {
      console.error("Error updating auction:", err);
      setError("Failed to update auction: " + err.message);
    } finally {
      setUpdatingAuction(false);
    }
  };

  const startEditingBid = (bidId: string, currentAmount: string) => {
    setEditingBid(bidId);
    setEditedBidAmount(currentAmount);
  };

  const cancelEditingBid = () => {
    setEditingBid(null);
    setEditedBidAmount('');
  };

  const saveBidAmount = async (bidId: string) => {
    if (!bidId || !editedBidAmount) return;

    const amount = parseFloat(editedBidAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Bid amount must be a positive number');
      return;
    }
    if (amount > 10000000) {
      setError('Bid amount cannot exceed ₹1,00,00,000');
      return;
    }

    setUpdatingBid(true);
    try {
      const response = await fetch('/api/admin/update-bid', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bidId: bidId,
          auctionId: auctionId,
          newAmount: editedBidAmount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update bid');
      }

      await fetchAuctionDetails();
      setEditingBid(null);
      setEditedBidAmount('');
      setError(null);

    } catch (err: any) {
      console.error("Error updating bid:", err);
      setError("Failed to update bid: " + err.message);
    } finally {
      setUpdatingBid(false);
    }
  };

  const deleteBid = async (bidId: string) => {
    if (!bidId) return;

    setDeletingBid(true);
    try {
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
        throw new Error(result.error || 'Failed to delete bid');
      }

      setShowDeleteConfirm(null);
      setError(null);

      setTimeout(() => {
        fetchAuctionDetails();
      }, 1000);

    } catch (err: any) {
      console.error("Error deleting bid:", err);
      setError("Failed to delete bid: " + err.message);
    } finally {
      setDeletingBid(false);
    }
  };

  const updateAuctionStatus = async () => {
    if (!auction || selectedStatus === auction.status) return;

    setUpdating(true);
    try {
      const response = await fetch('/api/admin/update-auction-status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auctionId: auctionId,
          status: selectedStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update auction status');
      }

      console.log('Auction status updated successfully:', result);
      await fetchAuctionDetails();
      setShowStatusManager(false);
    } catch (err: any) {
      console.error("Error updating auction status:", err);
      setError("Failed to update auction status: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading auction details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/auctions"
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Auctions
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3" />
              <div>
                <h3 className="font-semibold">Error loading auction details</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/auctions"
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Auctions
            </Link>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-4 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3" />
              <div>
                <h3 className="font-semibold">Auction not found</h3>
                <p className="text-sm mt-1">The requested auction could not be found.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/auctions"
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Auctions
          </Link>

          <div className="flex items-center space-x-6">
            {/* Real-time Status Indicators */}
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isRealTimeConnected ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span>
                  {isRealTimeConnected ? 'Real-time Connected' : 'Polling Mode'}
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

            {/* Auction Status and Controls */}
            <div className="flex items-center space-x-3">
              {getStatusIcon(auction.status)}
              <span className={getStatusBadge(auction.status)}>
                {auction.status?.charAt(0).toUpperCase() + auction.status?.slice(1)}
              </span>
              <button
              onClick={() => setShowStatusManager(true)}
              className="flex items-center px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Status
            </button>
            <button
              onClick={editingAuction ? cancelEditingAuction : startEditingAuction}
              className="flex items-center px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            >
              {editingAuction ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Cancel Edit
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Details
                </>
              )}
            </button>
            {editingAuction && (
              <button
                onClick={saveAuctionChanges}
                disabled={updatingAuction}
                className="flex items-center px-4 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {updatingAuction ? 'Saving...' : 'Save Changes'}
              </button>
            )}
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
                  onClick={() => setShowStatusManager(false)}
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
                      {auction.status?.charAt(0).toUpperCase() + auction.status?.slice(1)}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="incomplete">Incomplete</option>
                  </select>
                </div>

                {selectedStatus !== auction.status && (
                  <div className={`border rounded-lg p-3 ${
                    selectedStatus === 'cancelled'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex items-center">
                      <AlertCircle className={`w-4 h-4 mr-2 ${
                        selectedStatus === 'cancelled' ? 'text-red-600' : 'text-yellow-600'
                      }`} />
                      <span className={`text-sm ${
                        selectedStatus === 'cancelled' ? 'text-red-700' : 'text-yellow-700'
                      }`}>
                        This will change the auction status from{" "}
                        <strong>{auction.status}</strong> to{" "}
                        <strong>{selectedStatus}</strong>
                        {selectedStatus === 'cancelled' && (
                          <span className="block mt-1">
                            ⚠️ <strong>Warning:</strong> Cancelling will clear the current winner and winning bid!
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowStatusManager(false)}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateAuctionStatus}
                  disabled={updating || selectedStatus === auction.status}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedStatus === 'cancelled'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Save className="w-4 h-4 mr-1" />
                  {updating
                    ? "Updating..."
                    : selectedStatus === 'cancelled'
                      ? "Cancel Auction"
                      : "Update Status"
                  }
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Auction Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                  Delivery Information
                </h2>
              </div>

              <div className="space-y-6">
                {/* Route */}
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pickup Location
                    </label>
                    {editingAuction ? (
                      <input
                        type="text"
                        value={editedData.pickup}
                        onChange={(e) => setEditedData({ ...editedData, pickup: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter pickup location"
                      />
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-gray-900">{parseAuctionData(auction).pickup}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 pt-6">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <ArrowLeft className="w-4 h-4 text-blue-600 rotate-180" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Drop-off Location
                    </label>
                    {editingAuction ? (
                      <input
                        type="text"
                        value={editedData.dropoff}
                        onChange={(e) => setEditedData({ ...editedData, dropoff: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter drop-off location"
                      />
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                        <MapPin className="w-4 h-4 text-red-600 mr-2" />
                        <span className="text-gray-900">{parseAuctionData(auction).dropoff}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  {editingAuction ? (
                    <textarea
                      value={editedData.description}
                      onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Describe your delivery requirements"
                    />
                  ) : (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-900 whitespace-pre-wrap">{parseAuctionData(auction).description}</p>
                    </div>
                  )}
                </div>

                {/* Weight and Length */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Weight
                    </label>
                    {editingAuction ? (
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={editedData.weight}
                          onChange={(e) => setEditedData({ ...editedData, weight: e.target.value })}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter weight"
                        />
                        <select
                          value={editedData.weightUnit}
                          onChange={(e) => setEditedData({ ...editedData, weightUnit: e.target.value })}
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="kg">kg</option>
                          <option value="ton">ton</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                        <Weight className="w-4 h-4 text-purple-600 mr-2" />
                        <span className="text-gray-900">
                          {parseAuctionData(auction).weight} {parseAuctionData(auction).weightUnit}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Length (Optional)
                    </label>
                    {editingAuction ? (
                      <div className="flex space-x-2">
                        <input
                          type="number"
                          value={editedData.lengthValue}
                          onChange={(e) => setEditedData({ ...editedData, lengthValue: e.target.value })}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Length"
                        />
                        <select
                          value={editedData.lengthUnit}
                          onChange={(e) => setEditedData({ ...editedData, lengthUnit: e.target.value })}
                          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="meter">meters</option>
                          <option value="feet">feet</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                        <Ruler className="w-4 h-4 text-orange-600 mr-2" />
                        <span className="text-gray-900">
                          {editedData.lengthValue ? `${editedData.lengthValue} ${editedData.lengthUnit}` : 'Not specified'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Vehicle Requirements */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-6">
                <Truck className="w-5 h-5 mr-2 text-blue-600" />
                Vehicle Requirements
              </h2>

              <div className="space-y-6">
                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Vehicle Type
                  </label>
                  {editingAuction ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {VEHICLE_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEditedData({ ...editedData, vehicleType: type.id })}
                          className={`p-4 border-2 rounded-lg text-left transition-all ${
                            editedData.vehicleType === type.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-2xl mb-2">{type.icon}</div>
                          <div className="font-medium text-gray-900">{type.title}</div>
                          <div className="text-sm text-gray-600">{type.capacity}</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                      <span className="text-2xl mr-3">{getVehicleIcon(auction.vehicle_type)}</span>
                      <div>
                        <div className="font-medium text-gray-900">{formatVehicleType(auction.vehicle_type)}</div>
                        <div className="text-sm text-gray-600">
                          {VEHICLE_TYPES.find(v => v.id === auction.vehicle_type)?.capacity}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Body Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Body Type
                  </label>
                  {editingAuction ? (
                    <div className="space-y-2">
                      {BODY_TYPES.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setEditedData({ ...editedData, bodyType: type.id })}
                          className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                            editedData.bodyType === type.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="text-xl mr-3">{type.icon}</span>
                            <div>
                              <div className="font-medium text-gray-900">{type.title}</div>
                              <div className="text-sm text-gray-600">{type.description}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                      <span className="text-xl mr-3">
                        {BODY_TYPES.find(bt => bt.id === auction.body_type)?.icon || "📤"}
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">
                          {BODY_TYPES.find(bt => bt.id === auction.body_type)?.title || "Top Open"}
                        </div>
                        <div className="text-sm text-gray-600">
                          {BODY_TYPES.find(bt => bt.id === auction.body_type)?.description || "Open top for easy loading"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Wheel Configuration for Large Trucks */}
                {(editingAuction ? editedData.vehicleType === "large_truck" : auction.vehicle_type === "large_truck") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Wheel Configuration
                    </label>
                    {editingAuction ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {WHEEL_TYPES.map((type) => (
                          <button
                            key={type.value}
                            onClick={() => setEditedData({ ...editedData, wheelType: type.value })}
                            className={`p-3 border-2 rounded-lg text-center transition-all ${
                              editedData.wheelType === type.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="text-lg mb-1">{type.icon}</div>
                            <div className="text-sm font-medium text-gray-900">{type.label}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                        <span className="text-xl mr-3">
                          {WHEEL_TYPES.find(wt => wt.value === auction.wheel_type)?.icon || "🚛"}
                        </span>
                        <div className="font-medium text-gray-900">
                          {auction.wheel_type ? `${auction.wheel_type} Wheeler` : "4 Wheeler"}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Auction Timing */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-6">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Timing Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Created</label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <Calendar className="w-4 h-4 text-blue-600 mr-2" />
                    <span className="text-gray-900">
                      {new Date(auction.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auction Ends</label>
                  {editingAuction ? (
                    <input
                      type="datetime-local"
                      value={editedData.endTime ? new Date(editedData.endTime).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditedData({ ...editedData, endTime: new Date(e.target.value).toISOString() })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                  ) : (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-4 h-4 text-orange-600 mr-2" />
                      <div>
                        <div className="text-gray-900">
                          {new Date(auction.end_time).toLocaleDateString()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(auction.end_time).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Date</label>
                  {editingAuction ? (
                    <input
                      type="date"
                      value={editedData.consignmentDate ? new Date(editedData.consignmentDate).toISOString().slice(0, 10) : ''}
                      onChange={(e) => setEditedData({ ...editedData, consignmentDate: new Date(e.target.value).toISOString() })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  ) : (
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Truck className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-gray-900">
                        {new Date(auction.consignment_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {editingAuction && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Quick Duration Settings</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    {[
                      { label: '5 min', minutes: 5 },
                      { label: '15 min', minutes: 15 },
                      { label: '30 min', minutes: 30 },
                      { label: '1 hour', minutes: 60 },
                      { label: '2 hours', minutes: 120 },
                      { label: '4 hours', minutes: 240 },
                      { label: '8 hours', minutes: 480 },
                      { label: '1 day', minutes: 1440 },
                      { label: '2 days', minutes: 2880 },
                      { label: '3 days', minutes: 4320 },
                      { label: '1 week', minutes: 10080 },
                      { label: 'Custom', minutes: 0 }
                    ].map((option) => {
                      const currentDuration = Math.round((new Date(editedData.endTime).getTime() - new Date().getTime()) / (1000 * 60));
                      const isSelected = option.minutes === 0 ? false : Math.abs(currentDuration - option.minutes) < 5;

                      return (
                        <button
                          key={option.label}
                          onClick={() => {
                            if (option.minutes > 0) {
                              const newEndTime = new Date(Date.now() + option.minutes * 60000);
                              setEditedData({ ...editedData, endTime: newEndTime.toISOString() });
                            }
                          }}
                          className={`px-3 py-2 text-sm rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                          disabled={option.minutes === 0}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <span className="font-medium">Current duration: </span>
                    {(() => {
                      if (!editedData.endTime) return 'Not set';
                      const duration = Math.round((new Date(editedData.endTime).getTime() - new Date().getTime()) / (1000 * 60));
                      if (duration < 0) return 'Auction has ended';
                      if (duration < 60) return `${duration} minutes`;
                      if (duration < 1440) {
                        const hours = Math.floor(duration / 60);
                        const minutes = duration % 60;
                        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
                      }
                      const days = Math.floor(duration / 1440);
                      const hours = Math.floor((duration % 1440) / 60);
                      return hours > 0 ? `${days}d ${hours}h` : `${days} days`;
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - People & Bids */}
          <div className="space-y-6">
            {/* Consigner Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Consigner
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {getUserDisplayName(auction.consigner)}
                  </div>
                  <div className="text-sm text-gray-500">@{auction.consigner?.username}</div>
                </div>
                {auction.consigner?.email && (
                  <div className="text-sm text-gray-600">{auction.consigner.email}</div>
                )}
                {auction.consigner?.phone_number && (
                  <div className="text-sm text-gray-600">{auction.consigner.phone_number}</div>
                )}
              </div>
            </div>

            {/* Winner Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                <Trophy className="w-5 h-5 mr-2 text-yellow-600" />
                Winner
              </h3>
              {auction.winner ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-medium text-green-700">
                      {getUserDisplayName(auction.winner)}
                    </div>
                    <div className="text-sm text-gray-500">@{auction.winner.username}</div>
                  </div>
                  {auction.winner.vehicle_number && (
                    <div className="text-sm text-gray-600">{auction.winner.vehicle_number}</div>
                  )}
                  {auction.winner.phone_number && (
                    <div className="text-sm text-gray-600">{auction.winner.phone_number}</div>
                  )}
                  {auction.winning_bid && (
                    <div className="text-xl font-bold text-green-700">
                      ₹{parseFloat(auction.winning_bid.amount).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">No winner yet</p>
              )}
            </div>

            {/* Bid Statistics */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                Bid Statistics
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Bids</span>
                  <span className="text-2xl font-bold text-gray-900">{auction.bid_count || bids.length}</span>
                </div>
                {(auction.lowest_bid_amount || bids.length > 0) && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Lowest Bid</span>
                      <span className="text-lg font-semibold text-green-700">
                        ₹{auction.lowest_bid_amount
                          ? parseFloat(auction.lowest_bid_amount.toString()).toLocaleString()
                          : Math.min(...bids.map((b) => parseFloat(b.amount))).toLocaleString()
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Highest Bid</span>
                      <span className="text-lg font-semibold text-red-700">
                        ₹{auction.highest_bid_amount
                          ? parseFloat(auction.highest_bid_amount.toString()).toLocaleString()
                          : Math.max(...bids.map((b) => parseFloat(b.amount))).toLocaleString()
                        }
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bid History Section */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Users className="w-5 h-5 mr-2 text-blue-600" />
                Bid History ({bids.length} bids)
              </h2>
            </div>

            {bids.length > 0 ? (
              <div className="space-y-4">
                {bids.map((bid, index) => (
                  <div
                    key={bid.id}
                    className={`p-4 border-2 rounded-xl transition-all ${
                      auction.winner_id === bid.user_id
                        ? 'border-green-200 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {getUserDisplayName(bid.user)}
                          </div>
                          <div className="text-sm text-gray-500">@{bid.user?.username}</div>
                          {bid.user?.vehicle_number && (
                            <div className="text-sm text-gray-600">{bid.user.vehicle_number}</div>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-center space-x-3">
                          {editingBid === bid.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={editedBidAmount}
                                onChange={(e) => setEditedBidAmount(e.target.value)}
                                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                                min="1"
                                step="1"
                              />
                              <button
                                onClick={() => saveBidAmount(bid.id)}
                                disabled={updatingBid}
                                className="inline-flex items-center px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditingBid}
                                className="inline-flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-gray-900">
                                  ₹{parseFloat(bid.amount).toLocaleString()}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {new Date(bid.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {auction.winner_id === bid.user_id && (
                                  <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium flex items-center">
                                    <Trophy className="w-3 h-3 mr-1" />
                                    Winner
                                  </div>
                                )}
                                <button
                                  onClick={() => startEditingBid(bid.id, bid.amount)}
                                  className="inline-flex items-center px-2 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                                  title="Edit Amount"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(bid.id)}
                                  className="inline-flex items-center px-2 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                                  title="Delete Bid"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No bids placed yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}