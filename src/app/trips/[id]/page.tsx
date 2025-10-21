"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, isSupabaseAvailable } from "@/lib/supabase";
import {
  ArrowLeft,
  Calendar,
  User,
  Truck,
  Package,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Phone,
  FileText,
  Save,
  Edit3,
  X,
  Trash2,
} from "lucide-react";
import Link from "next/link";

interface TripDetail {
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
    vehicle_type: string | null;
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

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTrip, setDeletingTrip] = useState(false);

  useEffect(() => {
    if (tripId && isSupabaseAvailable()) {
      fetchTripDetails();
    }
  }, [tripId]);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          id, auction_id, driver_id, consigner_id, status, started_at,
          completed_at, delivery_notes, proof_of_delivery_url, created_at, updated_at,
          auction:auctions (
            id, title, description, vehicle_type, consignment_date
          ),
          driver:profiles!trips_driver_id_fkey (
            id, username, first_name, last_name, vehicle_number, vehicle_type, phone_number
          ),
          consigner:profiles!trips_consigner_id_fkey (
            id, username, first_name, last_name, phone_number
          )
        `
        )
        .eq("id", tripId)
        .single();

      if (error) throw error;

      setTrip(data);
      setDeliveryNotes(data.delivery_notes || "");
    } catch (err: any) {
      console.error("Error fetching trip details:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async () => {
    if (!trip) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", trip.id);

      if (error) throw error;

      await fetchTripDetails();
      setError(null);
    } catch (err: any) {
      console.error("Error updating trip status:", err);
      setError("Failed to mark trip as completed: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const markAsCancelled = async () => {
    if (!trip) return;

    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", trip.id);

      if (error) throw error;

      await fetchTripDetails();
      setError(null);
    } catch (err: any) {
      console.error("Error updating trip status:", err);
      setError("Failed to cancel trip: " + err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const saveDeliveryNotes = async () => {
    if (!trip) return;

    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("trips")
        .update({
          delivery_notes: deliveryNotes,
        })
        .eq("id", trip.id);

      if (error) throw error;

      await fetchTripDetails();
      setEditingNotes(false);
      setError(null);
    } catch (err: any) {
      console.error("Error saving delivery notes:", err);
      setError("Failed to save delivery notes: " + err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  const deleteTrip = async () => {
    if (!trip) return;

    setDeletingTrip(true);
    try {
      const { error } = await supabase
        .from("trips")
        .delete()
        .eq("id", trip.id);

      if (error) throw error;

      // Redirect to trips list after successful deletion
      router.push("/trips");
    } catch (err: any) {
      console.error("Error deleting trip:", err);
      setError("Failed to delete trip: " + err.message);
      setDeletingTrip(false);
      setShowDeleteConfirm(false);
    }
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
        return <Clock className="w-5 h-5 text-blue-600" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "cancelled":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      in_progress: "bg-blue-100 text-blue-800 border-blue-200",
      completed: "bg-green-100 text-green-800 border-green-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
    };
    return `px-3 py-1 rounded-full text-sm font-medium border ${
      styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800 border-gray-200"
    }`;
  };

  const getUserDisplayName = (user: any) => {
    if (user?.first_name || user?.last_name) {
      return `${user.first_name || ""} ${user.last_name || ""}`.trim();
    }
    return user?.username || "Unknown User";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/trips"
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Trips
            </Link>
          </div>
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3" />
              <div>
                <h3 className="font-semibold">Error loading trip details</h3>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/trips"
              className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Trips
            </Link>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-6 py-4 rounded-xl">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-3" />
              <div>
                <h3 className="font-semibold">Trip not found</h3>
                <p className="text-sm mt-1">The requested trip could not be found.</p>
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
            href="/trips"
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Trips
          </Link>

          <div className="flex items-center space-x-4">
            {getStatusIcon(trip.status)}
            <span className={getStatusBadge(trip.status)}>
              {trip.status
                .split("_")
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(" ")}
            </span>

            <div className="flex items-center space-x-3">
              {trip.status === "in_progress" && (
                <>
                  <button
                    onClick={markAsCompleted}
                    disabled={updatingStatus}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {updatingStatus ? "Updating..." : "Mark as Completed"}
                  </button>
                  <button
                    onClick={markAsCancelled}
                    disabled={updatingStatus}
                    className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {updatingStatus ? "Updating..." : "Cancel Trip"}
                  </button>
                </>
              )}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Trip
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Trip Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auction Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-6">
                <Package className="w-5 h-5 mr-2 text-blue-600" />
                Auction Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-900 font-medium">{trip.auction?.title}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {trip.auction?.description}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vehicle Type
                    </label>
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Truck className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-gray-900">
                        {trip.auction?.vehicle_type &&
                          formatVehicleType(trip.auction.vehicle_type)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consignment Date
                    </label>
                    <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <Calendar className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-gray-900">
                        {trip.auction?.consignment_date &&
                          new Date(trip.auction.consignment_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <Link
                    href={`/auctions/${trip.auction_id}`}
                    className="inline-flex items-center text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <MapPin className="w-4 h-4 mr-2" />
                    View Full Auction Details
                  </Link>
                </div>
              </div>
            </div>

            {/* Trip Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center mb-6">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Trip Timeline
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-600 mr-3" />
                    <div>
                      <p className="font-medium text-gray-900">Trip Started</p>
                      <p className="text-sm text-gray-600">
                        {new Date(trip.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>

                {trip.completed_at && (
                  <div
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      trip.status === "completed"
                        ? "bg-green-50"
                        : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-center">
                      {trip.status === "completed" ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 mr-3" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          Trip {trip.status === "completed" ? "Completed" : "Cancelled"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(trip.completed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {trip.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Notes */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Delivery Notes
                </h2>
                {!editingNotes && (
                  <button
                    onClick={() => setEditingNotes(true)}
                    className="flex items-center px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                  >
                    <Edit3 className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                )}
              </div>

              {editingNotes ? (
                <div className="space-y-4">
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add delivery notes, special instructions, or observations..."
                  />
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={saveDeliveryNotes}
                      disabled={savingNotes}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingNotes ? "Saving..." : "Save Notes"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(false);
                        setDeliveryNotes(trip.delivery_notes || "");
                      }}
                      className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg">
                  {trip.delivery_notes ? (
                    <p className="text-gray-900 whitespace-pre-wrap">{trip.delivery_notes}</p>
                  ) : (
                    <p className="text-gray-400 italic">No delivery notes added yet</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - People Info */}
          <div className="space-y-6">
            {/* Driver Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                <Truck className="w-5 h-5 mr-2 text-blue-600" />
                Driver
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {getUserDisplayName(trip.driver)}
                  </div>
                  <div className="text-sm text-gray-500">@{trip.driver?.username}</div>
                </div>
                {trip.driver?.vehicle_number && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Truck className="w-4 h-4 mr-2" />
                    {trip.driver.vehicle_number}
                  </div>
                )}
                {trip.driver?.phone_number && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    {trip.driver.phone_number}
                  </div>
                )}
              </div>
            </div>

            {/* Consigner Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
                <User className="w-5 h-5 mr-2 text-blue-600" />
                Consigner
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {getUserDisplayName(trip.consigner)}
                  </div>
                  <div className="text-sm text-gray-500">@{trip.consigner?.username}</div>
                </div>
                {trip.consigner?.phone_number && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="w-4 h-4 mr-2" />
                    {trip.consigner.phone_number}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Trip Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">
                Delete Trip
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete this trip for{" "}
                <span className="font-semibold">"{trip?.auction?.title}"</span>?
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium mb-1">Warning:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>This action cannot be undone</li>
                      <li>All trip data will be permanently deleted</li>
                      <li>Delivery notes will be lost</li>
                      <li>The auction will remain unchanged</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deletingTrip}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteTrip}
                  disabled={deletingTrip}
                  className="flex-1 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                  {deletingTrip ? (
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
    </div>
  );
}
