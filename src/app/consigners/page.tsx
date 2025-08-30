"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Users,
  TrendingUp,
  Package,
  Award,
  Search,
  Filter,
  Eye,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Activity,
} from "lucide-react";
import Link from "next/link";

interface ConsignerStats {
  totalConsigners: number;
  activeConsigners: number;
  totalAuctionsCreated: number;
  completedAuctions: number;
  avgAuctionsPerConsigner: number;
  topConsigners: any[];
}

interface Consigner {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  auction_count?: number;
  completed_auction_count?: number;
  total_bids_received?: number;
}

export default function ConsignersPage() {
  const [stats, setStats] = useState<ConsignerStats | null>(null);
  const [consigners, setConsigners] = useState<Consigner[]>([]);
  const [filteredConsigners, setFilteredConsigners] = useState<Consigner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "created" | "auctions">(
    "created"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConsignerData();
  }, []);

  useEffect(() => {
    filterConsigners();
  }, [consigners, searchTerm, sortBy]);

  const fetchConsignerData = async () => {
    try {
      // First get basic statistics efficiently
      const [consignersResult, auctionStatsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
            id,
            username,
            first_name,
            last_name,
            email,
            phone_number,
            address,
            created_at,
            updated_at
          `
          )
          .eq("role", "consigner")
          .order("created_at", { ascending: false }),

        supabase.rpc("get_consigner_auction_stats"),
      ]);

      if (consignersResult.error) throw consignersResult.error;

      const consignersData = consignersResult.data;

      // If RPC function doesn't exist, fallback to manual calculation
      if (auctionStatsResult.error) {
        console.log("RPC not available, using manual calculation");

        // Get auction counts for each consigner
        const consignersWithStats = await Promise.all(
          consignersData.map(async (consigner) => {
            const [auctionsResult, bidsResult] = await Promise.all([
              supabase
                .from("auctions")
                .select("id, status")
                .eq("created_by", consigner.id),
              supabase
                .from("auction_bids")
                .select("id")
                .in(
                  "auction_id",
                  (
                    await supabase
                      .from("auctions")
                      .select("id")
                      .eq("created_by", consigner.id)
                  ).data?.map((a) => a.id) || []
                ),
            ]);

            const auctions = auctionsResult.data || [];
            const bids = bidsResult.data || [];

            return {
              ...consigner,
              auction_count: auctions.length,
              completed_auction_count: auctions.filter(
                (a) => a.status === "completed"
              ).length,
              total_bids_received: bids.length,
            };
          })
        );

        setConsigners(consignersWithStats);

        // Calculate overall statistics
        const totalConsigners = consignersWithStats.length;
        const activeConsigners = consignersWithStats.filter(
          (c) => c.auction_count > 0
        ).length;
        const totalAuctionsCreated = consignersWithStats.reduce(
          (sum, c) => sum + c.auction_count,
          0
        );
        const completedAuctions = consignersWithStats.reduce(
          (sum, c) => sum + c.completed_auction_count,
          0
        );
        const avgAuctionsPerConsigner =
          totalConsigners > 0 ? totalAuctionsCreated / totalConsigners : 0;

        const topConsigners = consignersWithStats
          .filter((c) => c.auction_count > 0)
          .sort((a, b) => b.auction_count - a.auction_count)
          .slice(0, 5);

        setStats({
          totalConsigners,
          activeConsigners,
          totalAuctionsCreated,
          completedAuctions,
          avgAuctionsPerConsigner,
          topConsigners,
        });
      }
    } catch (err: any) {
      console.error("Error fetching consigner data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterConsigners = () => {
    let filtered = [...consigners];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (consigner) =>
          consigner.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          consigner.first_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          consigner.last_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          consigner.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.first_name || a.username || "").localeCompare(
            b.first_name || b.username || ""
          );
        case "auctions":
          return (b.auction_count || 0) - (a.auction_count || 0);
        case "created":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    setFilteredConsigners(filtered);
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
          Error loading consigner data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Consigners</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage consigner accounts and activities
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Consigners
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalConsigners || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Active Consigners
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.activeConsigners || 0}
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
                Total Auctions
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalAuctionsCreated || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Avg per Consigner
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.avgAuctionsPerConsigner
                  ? Math.round(stats.avgAuctionsPerConsigner * 10) / 10
                  : 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-50">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Top Consigners */}
      {stats?.topConsigners && stats.topConsigners.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Top Consigners
          </h2>
          <div className="space-y-3">
            {stats.topConsigners.map((consigner, index) => (
              <div
                key={consigner.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">
                      {consigner.first_name || consigner.last_name
                        ? `${consigner.first_name || ""} ${
                            consigner.last_name || ""
                          }`.trim()
                        : consigner.username}
                    </p>
                    <p className="text-sm text-gray-500">{consigner.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {consigner.auction_count} auctions
                  </p>
                  <p className="text-sm text-gray-500">
                    {consigner.completed_auction_count} completed
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search consigners..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="created">Recently Joined</option>
              <option value="name">Name A-Z</option>
              <option value="auctions">Most Auctions</option>
            </select>
          </div>
        </div>

        {/* Consigners Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Consigner
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Contact
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Auctions
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Success Rate
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Joined
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredConsigners.map((consigner) => (
                <tr
                  key={consigner.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {consigner.first_name || consigner.last_name
                          ? `${consigner.first_name || ""} ${
                              consigner.last_name || ""
                            }`.trim()
                          : consigner.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{consigner.username}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {consigner.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-1" />
                          {consigner.email}
                        </div>
                      )}
                      {consigner.phone_number && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-1" />
                          {consigner.phone_number}
                        </div>
                      )}
                      {consigner.address && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mr-1" />
                          {consigner.address}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">
                        {consigner.auction_count || 0}
                      </p>
                      <p className="text-sm text-gray-500">total auctions</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">
                        {(consigner.auction_count || 0) > 0
                          ? Math.round(
                              ((consigner.completed_auction_count || 0) /
                                (consigner.auction_count || 1)) *
                                100
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-sm text-gray-500">
                        {consigner.completed_auction_count || 0} completed
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(consigner.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Link
                      href={`/consigners/${consigner.id}`}
                      className="inline-flex items-center px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredConsigners.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No consigners found matching your search.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
