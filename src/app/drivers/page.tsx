"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  Truck,
  TrendingUp,
  Award,
  DollarSign,
  Search,
  Filter,
  Eye,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Activity,
  Car,
} from "lucide-react";
import Link from "next/link";

interface DriverStats {
  totalDrivers: number;
  activeDrivers: number;
  totalBidsPlaced: number;
  totalAuctionsWon: number;
  avgBidsPerDriver: number;
  vehicleTypeDistribution: { [key: string]: number };
  topDrivers: any[];
}

interface Driver {
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
  bids_count?: number;
  auctions_won?: number;
  total_bid_amount?: number;
}

export default function DriversPage() {
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "created" | "bids" | "wins">(
    "created"
  );
  const [error, setError] = useState<string | null>(null);

  const vehicleTypes = [
    "three_wheeler",
    "pickup_truck",
    "mini_truck",
    "medium_truck",
    "large_truck",
  ];

  useEffect(() => {
    if (isSupabaseAvailable()) {
      fetchDriverData();
    } else {
      setLoading(false);
      setError("Supabase configuration not available");
    }
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [drivers, searchTerm, vehicleFilter, sortBy]);

  const fetchDriverData = async () => {
    try {
      // Fetch drivers data
      const { data: driversData, error: driversError } = await supabase
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
          vehicle_type,
          vehicle_number,
          created_at,
          updated_at
        `
        )
        .eq("role", "driver")
        .order("created_at", { ascending: false });

      if (driversError) throw driversError;

      // Fetch bid and win statistics for each driver in batches to optimize performance
      const driversWithStats = await Promise.all(
        driversData.map(async (driver) => {
          try {
            const [bidsResult, wonAuctionsResult] = await Promise.all([
              supabase
                .from("auction_bids")
                .select("amount")
                .eq("user_id", driver.id),
              supabase.from("auctions").select("id").eq("winner_id", driver.id),
            ]);

            const bids = bidsResult.data || [];
            const wonAuctions = wonAuctionsResult.data || [];
            const totalBidAmount = bids.reduce(
              (sum, bid) => sum + (parseFloat(bid.amount) || 0),
              0
            );

            return {
              ...driver,
              bids_count: bids.length,
              auctions_won: wonAuctions.length,
              total_bid_amount: totalBidAmount,
            };
          } catch (err) {
            console.error(`Error fetching stats for driver ${driver.id}:`, err);
            return {
              ...driver,
              bids_count: 0,
              auctions_won: 0,
              total_bid_amount: 0,
            };
          }
        })
      );

      setDrivers(driversWithStats);

      // Calculate overall statistics
      const totalDrivers = driversWithStats.length;
      const activeDrivers = driversWithStats.filter(
        (d) => d.bids_count > 0
      ).length;
      const totalBidsPlaced = driversWithStats.reduce(
        (sum, d) => sum + d.bids_count,
        0
      );
      const totalAuctionsWon = driversWithStats.reduce(
        (sum, d) => sum + d.auctions_won,
        0
      );
      const avgBidsPerDriver =
        totalDrivers > 0 ? totalBidsPlaced / totalDrivers : 0;

      // Vehicle type distribution (handle null values)
      const vehicleTypeDistribution: { [key: string]: number } = {};
      driversWithStats.forEach((driver) => {
        const vehicleType = driver.vehicle_type || "not_specified";
        vehicleTypeDistribution[vehicleType] =
          (vehicleTypeDistribution[vehicleType] || 0) + 1;
      });

      // Top drivers (those who actually won auctions)
      const topDrivers = driversWithStats
        .filter((d) => d.auctions_won > 0)
        .sort((a, b) => b.auctions_won - a.auctions_won)
        .slice(0, 5);

      setStats({
        totalDrivers,
        activeDrivers,
        totalBidsPlaced,
        totalAuctionsWon,
        avgBidsPerDriver,
        vehicleTypeDistribution,
        topDrivers,
      });
    } catch (err: any) {
      console.error("Error fetching driver data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    let filtered = [...drivers];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (driver) =>
          driver.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          driver.vehicle_number
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Vehicle type filter
    if (vehicleFilter !== "all") {
      filtered = filtered.filter(
        (driver) => driver.vehicle_type === vehicleFilter
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.first_name || a.username || "").localeCompare(
            b.first_name || b.username || ""
          );
        case "bids":
          return (b.bids_count || 0) - (a.bids_count || 0);
        case "wins":
          return (b.auctions_won || 0) - (a.auctions_won || 0);
        case "created":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    setFilteredDrivers(filtered);
  };

  const formatVehicleType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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
          Error loading driver data: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Drivers</h1>
        <p className="text-gray-600 mt-2">
          Monitor and manage driver accounts and activities
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Drivers
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalDrivers || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Active Drivers
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.activeDrivers || 0}
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
                Total Bids
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalBidsPlaced || 0}
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
                Auctions Won
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalAuctionsWon || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-yellow-50">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle Type Distribution & Top Drivers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Vehicle Distribution
          </h2>
          <div className="space-y-3">
            {Object.entries(stats?.vehicleTypeDistribution || {}).map(
              ([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Car className="w-4 h-4 text-gray-400 mr-2" />
                    <span className="text-gray-700">
                      {formatVehicleType(type)}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{
                          width: `${
                            (count / (stats?.totalDrivers || 1)) * 100
                          }%`,
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {count}
                    </span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Top Drivers */}
        {stats?.topDrivers && stats.topDrivers.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Top Performing Drivers
            </h2>
            <div className="space-y-3">
              {stats.topDrivers.map((driver, index) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {driver.first_name || driver.last_name
                          ? `${driver.first_name || ""} ${
                              driver.last_name || ""
                            }`.trim()
                          : driver.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        {driver.vehicle_number}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {driver.auctions_won} wins
                    </p>
                    <p className="text-sm text-gray-500">
                      {driver.bids_count} bids
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
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
              <option value="created">Recently Joined</option>
              <option value="name">Name A-Z</option>
              <option value="bids">Most Bids</option>
              <option value="wins">Most Wins</option>
            </select>
          </div>
        </div>

        {/* Drivers Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Driver
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Vehicle
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Contact
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Performance
                </th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">
                  Win Rate
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
              {filteredDrivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {driver.first_name || driver.last_name
                          ? `${driver.first_name || ""} ${
                              driver.last_name || ""
                            }`.trim()
                          : driver.username}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{driver.username}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {driver.vehicle_number || "N/A"}
                      </p>
                      <p className="text-sm text-gray-500">
                        {driver.vehicle_type
                          ? formatVehicleType(driver.vehicle_type)
                          : "Not specified"}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="space-y-1">
                      {driver.phone_number && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-1" />
                          {driver.phone_number}
                        </div>
                      )}
                      {driver.email && (
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-1" />
                          {driver.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">
                        {driver.bids_count || 0} bids
                      </p>
                      <p className="text-sm text-gray-500">
                        {driver.auctions_won || 0} wins
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">
                        {(driver.bids_count || 0) > 0
                          ? Math.round(
                              ((driver.auctions_won || 0) /
                                (driver.bids_count || 1)) *
                                100
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-sm text-gray-500">success rate</p>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(driver.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <Link
                      href={`/drivers/${driver.id}`}
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

          {filteredDrivers.length === 0 && (
            <div className="text-center py-12">
              <Truck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                No drivers found matching your criteria.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
