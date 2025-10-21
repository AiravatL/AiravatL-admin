"use client";

import { useEffect, useState } from "react";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  Package,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Truck,
  Phone,
  MapPin,
} from "lucide-react";
import Link from "next/link";

interface TripStats {
  totalTrips: number;
  inProgressTrips: number;
  completedTrips: number;
  cancelledTrips: number;
}

interface Trip {
  id: string;
  auction_id: string;
  driver_id: string;
  consigner_id: string;
  status: "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  delivery_notes: string | null;
  proof_of_delivery_url: string | null;
  created_at: string;
  updated_at: string;
  // Related data
  auction?: {
    id: string;
    title: string;
    description: string;
    vehicle_type: string;
    consignment_date: string;
  };
  driver?: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    vehicle_number: string | null;
    phone_number: string | null;
  };
  consigner?: {
    id: string;
    username: string;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
  };
}

export default function TripsPage() {
  const [stats, setStats] = useState<TripStats | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filteredTrips, setFilteredTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"created" | "started" | "completed">(
    "started"
  );
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const vehicleTypes = [
    "three_wheeler",
    "pickup_truck",
    "mini_truck",
    "medium_truck",
    "large_truck",
  ];

  const statusTypes = ["in_progress", "completed", "cancelled"];

  useEffect(() => {
    if (isSupabaseAvailable()) {
      fetchTripData();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    filterTrips();
  }, [trips, searchTerm, statusFilter, sortBy, dateFilter, startDate, endDate, vehicleTypeFilter]);

  const fetchTripData = async () => {
    try {
      // Fetch trips with related data
      const { data: tripsData, error: tripsError } = await supabase
        .from("trips")
        .select(
          `
          id, auction_id, driver_id, consigner_id, status, started_at,
          completed_at, delivery_notes, proof_of_delivery_url, created_at, updated_at,
          auction:auctions (
            id, title, description, vehicle_type, consignment_date
          ),
          driver:profiles!trips_driver_id_fkey (
            id, username, first_name, last_name, vehicle_number, phone_number
          ),
          consigner:profiles!trips_consigner_id_fkey (
            id, username, first_name, last_name, phone_number
          )
        `
        )
        .order("started_at", { ascending: false });

      if (tripsError) throw tripsError;

      setTrips(tripsData || []);

      // Calculate statistics
      const totalTrips = tripsData?.length || 0;
      const inProgressTrips =
        tripsData?.filter((t) => t.status === "in_progress").length || 0;
      const completedTrips =
        tripsData?.filter((t) => t.status === "completed").length || 0;
      const cancelledTrips =
        tripsData?.filter((t) => t.status === "cancelled").length || 0;

      setStats({
        totalTrips,
        inProgressTrips,
        completedTrips,
        cancelledTrips,
      });
    } catch (err: any) {
      console.error("Error fetching trip data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterTrips = () => {
    let filtered = [...trips];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (trip) =>
          trip.auction?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          trip.driver?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          trip.consigner?.username
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          trip.driver?.first_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          trip.driver?.last_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          trip.consigner?.first_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          trip.consigner?.last_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((trip) => trip.status === statusFilter);
    }

    // Vehicle type filter
    if (vehicleTypeFilter !== "all") {
      filtered = filtered.filter(
        (trip) => trip.auction?.vehicle_type === vehicleTypeFilter
      );
    }

    // Date filter
    if (dateFilter !== "all" && dateFilter !== "custom") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.started_at);
        const tripDateOnly = new Date(
          tripDate.getFullYear(),
          tripDate.getMonth(),
          tripDate.getDate()
        );

        switch (dateFilter) {
          case "today":
            return tripDateOnly.getTime() === today.getTime();
          case "yesterday":
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return tripDateOnly.getTime() === yesterday.getTime();
          case "last7days":
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return tripDateOnly >= weekAgo;
          case "last30days":
            const monthAgo = new Date(today);
            monthAgo.setDate(monthAgo.getDate() - 30);
            return tripDateOnly >= monthAgo;
          case "thisMonth":
            return (
              tripDate.getMonth() === now.getMonth() &&
              tripDate.getFullYear() === now.getFullYear()
            );
          case "lastMonth":
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return (
              tripDate.getMonth() === lastMonth.getMonth() &&
              tripDate.getFullYear() === lastMonth.getFullYear()
            );
          default:
            return true;
        }
      });
    }

    // Specific date filter
    if (dateFilter === "specificDate" && startDate) {
      const selectedDate = new Date(startDate);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.started_at);
        const tripDateOnly = new Date(
          tripDate.getFullYear(),
          tripDate.getMonth(),
          tripDate.getDate()
        );
        return tripDateOnly.getTime() === selectedDate.getTime();
      });
    }

    // Custom date range filter
    if (dateFilter === "custom" && startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      filtered = filtered.filter((trip) => {
        const tripDate = new Date(trip.started_at);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return tripDate >= start && tripDate <= end;
        }
        return tripDate >= start;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "started":
          return (
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          );
        case "completed":
          return (
            new Date(b.completed_at || 0).getTime() -
            new Date(a.completed_at || 0).getTime()
          );
        case "created":
        default:
          return (
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }
    });

    setFilteredTrips(filtered);
  };

  const formatVehicleType = (type: string) => {
    return type
      ?.split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-600" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: "bg-blue-100 text-blue-800",
      completed: "bg-green-100 text-green-800",
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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Error loading trip data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Trips</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage delivery trips
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Total Trips
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalTrips || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                In Progress
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.inProgressTrips || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Completed
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.completedTrips || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-green-50">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Cancelled
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.cancelledTrips || 0}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-red-50">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
        <div className="flex flex-col space-y-4 mb-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search trips by title, driver, or consigner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900 bg-white placeholder-gray-500"
            />
          </div>

          {/* Filter Row 1: Status, Vehicle Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    {status
                      .split("_")
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(" ")}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
            >
              <option value="all">All Vehicle Types</option>
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
              <option value="started">Recently Started</option>
              <option value="completed">Recently Completed</option>
              <option value="created">Recently Created</option>
            </select>
          </div>

          {/* Filter Row 2: Date Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="specificDate">Specific Date</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateFilter === "specificDate" && (
              <div className="sm:col-span-2 lg:col-span-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(e.target.value); // Set same date for end
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Select Date"
                />
              </div>
            )}

            {dateFilter === "custom" && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 text-gray-900 bg-white"
                  placeholder="End Date"
                />
              </>
            )}
          </div>

          {/* Active Filters Display */}
          {(searchTerm || statusFilter !== "all" || vehicleTypeFilter !== "all" || dateFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
              <span className="text-sm font-medium text-gray-600">Active Filters:</span>
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs flex items-center">
                  Search: "{searchTerm}"
                  <button
                    onClick={() => setSearchTerm("")}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {statusFilter !== "all" && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center">
                  Status: {statusFilter.split("_").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ")}
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="ml-1 hover:text-green-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {vehicleTypeFilter !== "all" && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs flex items-center">
                  Vehicle: {formatVehicleType(vehicleTypeFilter)}
                  <button
                    onClick={() => setVehicleTypeFilter("all")}
                    className="ml-1 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {dateFilter !== "all" && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs flex items-center">
                  Date: {
                    dateFilter === "specificDate"
                      ? startDate
                      : dateFilter === "custom"
                        ? `${startDate} to ${endDate || "now"}`
                        : dateFilter.replace(/([A-Z])/g, ' $1').trim().charAt(0).toUpperCase() + dateFilter.replace(/([A-Z])/g, ' $1').trim().slice(1)
                  }
                  <button
                    onClick={() => {
                      setDateFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="ml-1 hover:text-orange-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setVehicleTypeFilter("all");
                  setDateFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing <span className="font-semibold text-gray-900">{filteredTrips.length}</span> of{" "}
            <span className="font-semibold text-gray-900">{trips.length}</span> trips
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden xl:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Auction
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Driver
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Consigner
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Status
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Started
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Completed
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-900">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => (
                <tr
                  key={trip.id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {trip.auction?.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {trip.auction?.vehicle_type &&
                          formatVehicleType(trip.auction.vehicle_type)}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {trip.driver?.first_name || trip.driver?.last_name
                          ? `${trip.driver.first_name || ""} ${
                              trip.driver.last_name || ""
                            }`.trim()
                          : trip.driver?.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        {trip.driver?.vehicle_number}
                      </p>
                      {trip.driver?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {trip.driver.phone_number}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {trip.consigner?.first_name || trip.consigner?.last_name
                          ? `${trip.consigner.first_name || ""} ${
                              trip.consigner.last_name || ""
                            }`.trim()
                          : trip.consigner?.username}
                      </p>
                      {trip.consigner?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {trip.consigner.phone_number}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center">
                      {getStatusIcon(trip.status)}
                      <span className={`ml-1 ${getStatusBadge(trip.status)}`}>
                        {trip.status
                          .split("_")
                          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                          .join(" ")}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-xs text-gray-600">
                      {new Date(trip.started_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="text-xs text-gray-600">
                      {trip.completed_at
                        ? new Date(trip.completed_at).toLocaleDateString()
                        : "-"}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <Link
                      href={`/trips/${trip.id}`}
                      className="inline-flex items-center justify-center px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile/Tablet Card View */}
        <div className="xl:hidden space-y-4">
          {filteredTrips.map((trip) => (
            <div
              key={trip.id}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900">
                    {trip.auction?.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {trip.auction?.vehicle_type &&
                      formatVehicleType(trip.auction.vehicle_type)}
                  </p>
                </div>
                <div className="flex items-center ml-4">
                  {getStatusIcon(trip.status)}
                  <span className={`ml-1 ${getStatusBadge(trip.status)}`}>
                    {trip.status
                      .split("_")
                      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                      .join(" ")}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600 mb-1">Driver</p>
                  <div className="flex items-start">
                    <Truck className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {trip.driver?.first_name || trip.driver?.last_name
                          ? `${trip.driver.first_name || ""} ${
                              trip.driver.last_name || ""
                            }`.trim()
                          : trip.driver?.username}
                      </p>
                      <p className="text-xs text-gray-500">
                        {trip.driver?.vehicle_number}
                      </p>
                      {trip.driver?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {trip.driver.phone_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-gray-600 mb-1">Consigner</p>
                  <div className="flex items-start">
                    <User className="w-4 h-4 text-gray-400 mr-2 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {trip.consigner?.first_name || trip.consigner?.last_name
                          ? `${trip.consigner.first_name || ""} ${
                              trip.consigner.last_name || ""
                            }`.trim()
                          : trip.consigner?.username}
                      </p>
                      {trip.consigner?.phone_number && (
                        <p className="text-xs text-gray-600 flex items-center mt-1">
                          <Phone className="w-3 h-3 mr-1" />
                          {trip.consigner.phone_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  <div className="flex items-center mb-1">
                    <Calendar className="w-3 h-3 mr-1" />
                    Started: {new Date(trip.started_at).toLocaleDateString()}
                  </div>
                  {trip.completed_at && (
                    <div className="flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Completed:{" "}
                      {new Date(trip.completed_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <Link
                  href={`/trips/${trip.id}`}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filteredTrips.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">
              No trips found matching your criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
