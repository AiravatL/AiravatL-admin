"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
    "created",
  );
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);

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

  useEffect(() => {
    filterDrivers();
  }, [drivers, searchTerm, vehicleFilter, sortBy]);

  const fetchDriverData = useCallback(async () => {
    try {
      // Optimized query: Get all data in fewer queries
      const [driversResult, bidsResult, wonAuctionsResult] = await Promise.all([
        // Get all drivers
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
            vehicle_type,
            vehicle_number,
            created_at,
            updated_at
          `,
          )
          .eq("role", "driver")
          .order("created_at", { ascending: false }),

        // Get all bids in one query
        supabase.from("auction_bids").select("user_id, amount"),

        // Get all won auctions in one query
        supabase
          .from("auctions")
          .select("winner_id")
          .not("winner_id", "is", null),
      ]);

      if (driversResult.error) throw driversResult.error;
      if (bidsResult.error) throw bidsResult.error;
      if (wonAuctionsResult.error) throw wonAuctionsResult.error;

      const driversData = driversResult.data;
      const bidsData = bidsResult.data || [];
      const wonAuctionsData = wonAuctionsResult.data || [];

      // Build lookup maps for O(1) access
      const bidsByDriver = new Map();
      const wonAuctionsByDriver = new Map();

      // Process bids
      bidsData.forEach((bid) => {
        const driverId = bid.user_id;
        if (!bidsByDriver.has(driverId)) {
          bidsByDriver.set(driverId, { count: 0, totalAmount: 0 });
        }
        const stats = bidsByDriver.get(driverId);
        stats.count++;
        stats.totalAmount += parseFloat(bid.amount) || 0;
      });

      // Process won auctions
      wonAuctionsData.forEach((auction) => {
        const driverId = auction.winner_id;
        wonAuctionsByDriver.set(
          driverId,
          (wonAuctionsByDriver.get(driverId) || 0) + 1,
        );
      });

      // Combine data efficiently
      const driversWithStats = driversData.map((driver) => {
        const bidStats = bidsByDriver.get(driver.id) || {
          count: 0,
          totalAmount: 0,
        };
        const auctionsWon = wonAuctionsByDriver.get(driver.id) || 0;

        return {
          ...driver,
          bids_count: bidStats.count,
          auctions_won: auctionsWon,
          total_bid_amount: bidStats.totalAmount,
        };
      });

      setDrivers(driversWithStats);

      // Calculate overall statistics
      const totalDrivers = driversWithStats.length;
      const activeDrivers = driversWithStats.filter(
        (d) => d.bids_count > 0,
      ).length;
      const totalBidsPlaced = driversWithStats.reduce(
        (sum, d) => sum + d.bids_count,
        0,
      );
      const totalAuctionsWon = driversWithStats.reduce(
        (sum, d) => sum + d.auctions_won,
        0,
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
  }, []);

  const setupRealTimeSubscriptions = useCallback(() => {
    console.log("Setting up real-time subscriptions for drivers");

    const channel = supabase
      .channel("drivers_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: "role=eq.driver",
        },
        (payload) => {
          console.log("Driver change detected:", payload);
          fetchDriverData();
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
          fetchDriverData();
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
          fetchDriverData();
        },
      )
      .subscribe((status) => {
        console.log("Drivers subscription status:", status);
      });

    subscriptionRef.current = channel;
  }, [fetchDriverData]);

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
            .includes(searchTerm.toLowerCase()),
      );
    }

    // Vehicle type filter
    if (vehicleFilter !== "all") {
      filtered = filtered.filter(
        (driver) => driver.vehicle_type === vehicleFilter,
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.first_name || a.username || "").localeCompare(
            b.first_name || b.username || "",
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
              ),
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

        {/* Drivers List - Card Layout for Better UX */}
        <div className="space-y-4">
          {filteredDrivers.map((driver) => (
            <div
              key={driver.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Driver Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {driver.first_name || driver.last_name
                          ? `${driver.first_name || ""} ${
                              driver.last_name || ""
                            }`.trim()
                          : driver.username}
                      </h3>
                      <p className="text-sm text-gray-500">
                        @{driver.username}
                      </p>
                    </div>
                    <Link
                      href={`/drivers/${driver.id}`}
                      className="inline-flex items-center px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded-full hover:bg-indigo-200 transition-colors ml-2 flex-shrink-0"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Details
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                    {/* Vehicle */}
                    <div className="flex items-start space-x-2">
                      <Car className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Vehicle</p>
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {driver.vehicle_number || "N/A"}
                        </p>
                        <p className="text-xs text-gray-600">
                          {driver.vehicle_type
                            ? formatVehicleType(driver.vehicle_type)
                            : "Not specified"}
                        </p>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Address</p>
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {driver.address || "Not provided"}
                        </p>
                      </div>
                    </div>

                    {/* Contact */}
                    <div className="flex items-start space-x-2">
                      <Phone className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500">Contact</p>
                        {driver.phone_number && (
                          <p className="text-sm text-gray-900 truncate">
                            {driver.phone_number}
                          </p>
                        )}
                        {driver.email && (
                          <p className="text-xs text-gray-600 truncate">
                            {driver.email}
                          </p>
                        )}
                        {!driver.phone_number && !driver.email && (
                          <p className="text-sm text-gray-400">Not provided</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-start space-x-2">
                      <Activity className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Performance</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">
                              {driver.bids_count || 0}
                            </p>
                            <p className="text-xs text-gray-500">bids</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-gray-900">
                              {driver.auctions_won || 0}
                            </p>
                            <p className="text-xs text-gray-500">wins</p>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-semibold text-indigo-600">
                              {(driver.bids_count || 0) > 0
                                ? Math.round(
                                    ((driver.auctions_won || 0) /
                                      (driver.bids_count || 1)) *
                                      100,
                                  )
                                : 0}
                              %
                            </p>
                            <p className="text-xs text-gray-500">rate</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Joined Date */}
                  <div className="flex items-center text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                    <Calendar className="w-3 h-3 mr-1" />
                    Joined {new Date(driver.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

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
