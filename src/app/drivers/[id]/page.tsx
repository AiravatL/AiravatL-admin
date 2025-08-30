"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Truck,
  TrendingUp,
  Award,
  DollarSign,
  Activity,
  Eye,
  Car,
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
  created_at: string;
  updated_at: string;
}

interface DriverActivity {
  bids: any[];
  auctions: any[];
  totalBids: number;
  totalAuctionsWon: number;
  winRate: number;
  totalAmountBid: number;
  avgBidAmount: number;
  recentActivity: any[];
}

export default function DriverDetailPage() {
  const params = useParams();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [activity, setActivity] = useState<DriverActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchDriverDetails(params.id as string);
    }
  }, [params.id]);

  const fetchDriverDetails = async (driverId: string) => {
    try {
      // Fetch driver profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", driverId)
        .eq("role", "driver")
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch bids placed by this driver
      const { data: bidsData, error: bidsError } = await supabase
        .from("auction_bids")
        .select(
          `
          *,
          auctions (
            id,
            title,
            description,
            vehicle_type,
            status,
            winner_id,
            created_at
          )
        `
        )
        .eq("user_id", driverId)
        .order("created_at", { ascending: false });

      if (bidsError) throw bidsError;

      // Fetch auctions won by this driver
      const { data: wonAuctionsData, error: wonAuctionsError } = await supabase
        .from("auctions")
        .select("*")
        .eq("winner_id", driverId)
        .order("created_at", { ascending: false });

      if (wonAuctionsError) throw wonAuctionsError;

      // Calculate activity statistics
      const totalBids = bidsData.length;
      const totalAuctionsWon = wonAuctionsData.length;
      const winRate = totalBids > 0 ? (totalAuctionsWon / totalBids) * 100 : 0;
      const totalAmountBid = bidsData.reduce(
        (sum, bid) => sum + (bid.amount || 0),
        0
      );
      const avgBidAmount = totalBids > 0 ? totalAmountBid / totalBids : 0;

      // Get recent activity from audit logs
      const { data: recentActivity } = await supabase
        .from("auction_audit_logs")
        .select("*")
        .eq("user_id", driverId)
        .order("created_at", { ascending: false })
        .limit(10);

      setActivity({
        bids: bidsData,
        auctions: wonAuctionsData,
        totalBids,
        totalAuctionsWon,
        winRate,
        totalAmountBid,
        avgBidAmount,
        recentActivity: recentActivity || [],
      });
    } catch (err: any) {
      console.error("Error fetching driver details:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      completed: "bg-blue-100 text-blue-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${
      styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800"
    }`;
  };

  const formatVehicleType = (type: string) => {
    return type
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-4">
        <Link
          href="/drivers"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Drivers
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            {error || "Driver not found"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/drivers"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Drivers
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {profile.first_name || profile.last_name
                ? `${profile.first_name || ""} ${
                    profile.last_name || ""
                  }`.trim()
                : profile.username}
            </h1>
            <p className="text-gray-600">@{profile.username}</p>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Profile Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center">
              <User className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Full Name</p>
                <p className="font-medium text-gray-900">
                  {profile.first_name || profile.last_name
                    ? `${profile.first_name || ""} ${
                        profile.last_name || ""
                      }`.trim()
                    : "Not provided"}
                </p>
              </div>
            </div>
            {profile.email && (
              <div className="flex items-center">
                <Mail className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{profile.email}</p>
                </div>
              </div>
            )}
            {profile.phone_number && (
              <div className="flex items-center">
                <Phone className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">
                    {profile.phone_number}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-4">
            {profile.vehicle_type && (
              <div className="flex items-center">
                <Car className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Vehicle Type</p>
                  <p className="font-medium text-gray-900">
                    {formatVehicleType(profile.vehicle_type)}
                  </p>
                </div>
              </div>
            )}
            {profile.vehicle_number && (
              <div className="flex items-center">
                <Truck className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Vehicle Number</p>
                  <p className="font-medium text-gray-900">
                    {profile.vehicle_number}
                  </p>
                </div>
              </div>
            )}
            {profile.address && (
              <div className="flex items-center">
                <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="font-medium text-gray-900">{profile.address}</p>
                </div>
              </div>
            )}
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm text-gray-500">Joined</p>
                <p className="font-medium text-gray-900">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Bids
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.totalBids || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Win Rate</p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.winRate ? Math.round(activity.winRate) : 0}%
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-50">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Auctions Won
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.totalAuctionsWon || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50">
              <Award className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Avg Bid Amount
              </p>
              <p className="text-3xl font-bold text-gray-900">
                ₹
                {activity?.avgBidAmount ? Math.round(activity.avgBidAmount) : 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-50">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Bids */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Bids
        </h2>
        {activity?.bids && activity.bids.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Auction
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Bid Amount
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Result
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Placed
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activity.bids.slice(0, 10).map((bid) => (
                  <tr
                    key={bid.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {bid.auctions?.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {bid.auctions?.vehicle_type
                            ?.replace("_", " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-semibold text-gray-900">
                        ₹{bid.amount?.toLocaleString()}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <span className={getStatusBadge(bid.auctions?.status)}>
                        {bid.auctions?.status?.charAt(0).toUpperCase() +
                          bid.auctions?.status?.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {bid.auctions?.winner_id === profile.id ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Won
                        </span>
                      ) : bid.auctions?.status === "completed" ? (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          Lost
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(bid.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <Link
                        href={`/auctions/${bid.auctions?.id}`}
                        className="inline-flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View Auction
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No bids placed yet.</p>
          </div>
        )}
      </div>

      {/* Won Auctions */}
      {activity?.auctions && activity.auctions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Won Auctions
          </h2>
          <div className="overflow-x-auto">
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
                    Consignment Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Won Date
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activity.auctions.map((auction) => (
                  <tr
                    key={auction.id}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {auction.title}
                        </p>
                        <p className="text-sm text-gray-500 truncate max-w-xs">
                          {auction.description}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                        {formatVehicleType(auction.vehicle_type)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(
                          auction.consignment_date
                        ).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(auction.updated_at).toLocaleDateString()}
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
        </div>
      )}

      {/* Recent Activity */}
      {activity?.recentActivity && activity.recentActivity.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            {activity.recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{log.action}</p>
                  {log.details && (
                    <p className="text-sm text-gray-500">
                      {JSON.stringify(log.details).slice(0, 100)}...
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
