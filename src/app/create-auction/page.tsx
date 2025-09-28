"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  MapPin,
  Package,
  Truck,
  Weight,
  Clock,
  Calendar,
  Save,
  Ruler,
  CheckCircle,
} from "lucide-react";

// Vehicle type mappings
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

const WEIGHT_UNITS = [
  { value: "kg", symbol: "kg" },
  { value: "ton", symbol: "ton" },
];

const LENGTH_UNITS = [
  { value: "meter", symbol: "meters" },
  { value: "feet", symbol: "feet" },
];

interface AuctionFormData {
  from: string;
  to: string;
  description: string;
  weight: string;
  weightUnit: "kg" | "ton";
  vehicleType: string;
  duration: number;
  consignmentDate: string;
  lengthValue: string;
  lengthUnit: "meter" | "feet";
  bodyType: "container" | "top_open" | "trailer";
  wheelType: 4 | 6 | 10 | 12 | 14 | 18;
}

export default function CreateAuctionPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<AuctionFormData>({
    from: "",
    to: "",
    description: "",
    weight: "",
    weightUnit: "kg",
    vehicleType: "",
    duration: 60, // 1 hour default
    consignmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // tomorrow
    lengthValue: "",
    lengthUnit: "meter",
    bodyType: "top_open",
    wheelType: 4,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitProgress, setSubmitProgress] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.from.trim()) newErrors.from = "Pickup location is required";
    if (!formData.to.trim()) newErrors.to = "Destination is required";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.weight.trim()) newErrors.weight = "Weight is required";
    if (!formData.vehicleType) newErrors.vehicleType = "Vehicle type is required";

    const weightNum = parseFloat(formData.weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      newErrors.weight = "Please enter a valid weight";
    }

    if (formData.duration < 5) {
      newErrors.duration = "Duration must be at least 5 minutes";
    }

    if (formData.duration > 7 * 24 * 60) {
      newErrors.duration = "Duration cannot exceed 7 days";
    }

    // Validate dates
    const consignmentDate = new Date(formData.consignmentDate);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const consignmentDateOnly = new Date(consignmentDate.getFullYear(), consignmentDate.getMonth(), consignmentDate.getDate());

    if (consignmentDateOnly < today) {
      newErrors.consignmentDate = "Consignment date cannot be in the past";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitProgress('Validating auction data...');

    try {
      setSubmitProgress('Creating auction...');

      const response = await fetch('/api/admin/create-auction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      setSubmitProgress('Processing response...');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create auction');
      }

      setSubmitProgress('Auction created successfully!');
      setShowSuccess(true);

      // Redirect after showing success message
      setTimeout(() => {
        router.push('/auctions');
      }, 1500); // Reduced from 2000ms to 1500ms

    } catch (err: any) {
      console.error("Error creating auction:", err);
      setErrors({ submit: err.message });
      setSubmitProgress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Memoized duration formatter for performance
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`;
      }
      return `${hours}h ${remainingMinutes}m`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      if (remainingHours === 0) {
        return `${days} day${days !== 1 ? 's' : ''}`;
      }
      return `${days}d ${remainingHours}h`;
    }
  };

  // Optimized validation with debouncing effect
  const validateField = (field: string, value: any) => {
    const newErrors = { ...errors };
    delete newErrors[field];

    switch (field) {
      case 'from':
        if (!value?.trim()) newErrors.from = "Pickup location is required";
        break;
      case 'to':
        if (!value?.trim()) newErrors.to = "Destination is required";
        break;
      case 'weight':
        const weightNum = parseFloat(value);
        if (!value?.trim()) newErrors.weight = "Weight is required";
        else if (isNaN(weightNum) || weightNum <= 0) newErrors.weight = "Please enter a valid weight";
        break;
    }

    setErrors(newErrors);
  };

  if (showSuccess) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Auction Created Successfully!</h2>
          <p className="text-gray-600 mb-4">
            The auction will run for {formatDuration(formData.duration)} starting now.
          </p>
          <p className="text-sm text-gray-500">Redirecting to auctions list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Auction</h1>
          <p className="text-gray-600 mt-2">
            Create a new auction for the admin consigner account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Pickup and Destination */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <MapPin className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Delivery Route</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Location *
                </label>
                <input
                  type="text"
                  value={formData.from}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, from: value });
                    validateField('from', value);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter pickup location"
                />
                {errors.from && <p className="text-red-600 text-sm mt-1">{errors.from}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Destination *
                </label>
                <input
                  type="text"
                  value={formData.to}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, to: value });
                    validateField('to', value);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter destination"
                />
                {errors.to && <p className="text-red-600 text-sm mt-1">{errors.to}</p>}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Package className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Description</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Details *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe your delivery requirements..."
              />
              {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description}</p>}
            </div>
          </div>

          {/* Weight and Length */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Weight className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Cargo Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight *
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({ ...formData, weight: value });
                      validateField('weight', value);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter weight"
                  />
                  <select
                    value={formData.weightUnit}
                    onChange={(e) => setFormData({ ...formData, weightUnit: e.target.value as "kg" | "ton" })}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {WEIGHT_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.symbol}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.weight && <p className="text-red-600 text-sm mt-1">{errors.weight}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length (Optional)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={formData.lengthValue}
                    onChange={(e) => setFormData({ ...formData, lengthValue: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Length"
                  />
                  <select
                    value={formData.lengthUnit}
                    onChange={(e) => setFormData({ ...formData, lengthUnit: e.target.value as "meter" | "feet" })}
                    className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {LENGTH_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.symbol}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Truck className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Vehicle Requirements</h2>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Vehicle Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {VEHICLE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, vehicleType: type.id })}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      formData.vehicleType === type.id
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
              {errors.vehicleType && <p className="text-red-600 text-sm mt-2">{errors.vehicleType}</p>}
            </div>

            {/* Body Type */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-gray-700 mb-4">
                Body Type
              </label>
              <div className="space-y-3">
                {BODY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, bodyType: type.id as any })}
                    className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                      formData.bodyType === type.id
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
            </div>

            {/* Wheel Configuration for Large Trucks */}
            {formData.vehicleType === "large_truck" && (
              <div className="mt-8">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Wheel Configuration
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {WHEEL_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, wheelType: type.value as any })}
                      className={`p-3 border-2 rounded-lg text-center transition-all ${
                        formData.wheelType === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-lg mb-1">{type.icon}</div>
                      <div className="text-sm font-medium text-gray-900">{type.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timing */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-6">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Timing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Consignment Date *
                </label>
                <input
                  type="date"
                  value={formData.consignmentDate}
                  onChange={(e) => setFormData({ ...formData, consignmentDate: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.consignmentDate && <p className="text-red-600 text-sm mt-1">{errors.consignmentDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auction Duration *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={480}>8 hours</option>
                  <option value={1440}>1 day</option>
                  <option value={2880}>2 days</option>
                  <option value={4320}>3 days</option>
                  <option value={10080}>1 week</option>
                </select>
                {errors.duration && <p className="text-red-600 text-sm mt-1">{errors.duration}</p>}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isSubmitting ? (submitProgress || 'Creating...') : 'Create Auction'}
            </button>
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
              <p>{errors.submit}</p>
            </div>
          )}
        </form>
    </div>
  );
}