"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Gavel,
  TrendingUp,
  Award,
  DollarSign,
  Activity,
  Eye,
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
}

interface ConsignerActivity {
  auctions: any[];
  totalAuctions: number;
  activeAuctions: number;
  completedAuctions: number;
  cancelledAuctions: number;
  totalBidsReceived: number;
  avgBidsPerAuction: number;
  successRate: number;
  recentActivity: any[];
}

export default function ConsignerDetailPage() {
  const params = useParams();
  const [profile, setProfile] = useState<ConsignerProfile | null>(null);
  const [activity, setActivity] = useState<ConsignerActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchConsignerDetails(params.id as string);
    }
  }, [params.id]);

  const fetchConsignerDetails = async (consignerId: string) => {
    try {
      // Fetch consigner profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", consignerId)
        .eq("role", "consigner")
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch auctions created by this consigner
      const { data: auctionsData, error: auctionsError } = await supabase
        .from("auctions")
        .select(
          `
          *,
          auction_bids (
            id,
            amount,
            user_id,
            created_at
          )
        `
        )
        .eq("created_by", consignerId)
        .order("created_at", { ascending: false });

      if (auctionsError) throw auctionsError;

      // Calculate activity statistics
      const totalAuctions = auctionsData.length;
      const activeAuctions = auctionsData.filter(
        (a) => a.status === "active"
      ).length;
      const completedAuctions = auctionsData.filter(
        (a) => a.status === "completed"
      ).length;
      const cancelledAuctions = auctionsData.filter(
        (a) => a.status === "cancelled"
      ).length;

      const totalBidsReceived = auctionsData.reduce(
        (sum, auction) => sum + (auction.auction_bids?.length || 0),
        0
      );

      const avgBidsPerAuction =
        totalAuctions > 0 ? totalBidsReceived / totalAuctions : 0;
      const successRate =
        totalAuctions > 0 ? (completedAuctions / totalAuctions) * 100 : 0;

      // Get recent activity from audit logs
      const { data: recentActivity } = await supabase
        .from("auction_audit_logs")
        .select("*")
        .eq("user_id", consignerId)
        .order("created_at", { ascending: false })
        .limit(10);

      setActivity({
        auctions: auctionsData,
        totalAuctions,
        activeAuctions,
        completedAuctions,
        cancelledAuctions,
        totalBidsReceived,
        avgBidsPerAuction,
        successRate,
        recentActivity: recentActivity || [],
      });
    } catch (err: any) {
      console.error("Error fetching consigner details:", err);
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
          href="/consigners"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Consigners
        </Link>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            {error || "Consigner not found"}
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
            href="/consigners"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Consigners
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
                Total Auctions
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.totalAuctions || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Gavel className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Success Rate
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.successRate ? Math.round(activity.successRate) : 0}%
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
                Total Bids Received
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.totalBidsReceived || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Avg Bids/Auction
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {activity?.avgBidsPerAuction
                  ? Math.round(activity.avgBidsPerAuction * 10) / 10
                  : 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-50">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Auctions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Recent Auctions
        </h2>
        {activity?.auctions && activity.auctions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Title
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
                    Created
                  </th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {activity.auctions.slice(0, 10).map((auction) => (
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
                        {auction.vehicle_type
                          ?.replace("_", " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className={getStatusBadge(auction.status)}>
                        {auction.status?.charAt(0).toUpperCase() +
                          auction.status?.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-center">
                        <p className="font-semibold text-gray-900">
                          {auction.auction_bids?.length || 0}
                        </p>
                        <p className="text-sm text-gray-500">bids</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        {new Date(auction.created_at).toLocaleDateString()}
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
        ) : (
          <div className="text-center py-12">
            <Gavel className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No auctions created yet.</p>
          </div>
        )}
      </div>

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
