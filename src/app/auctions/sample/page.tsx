"use client";

import { ArrowLeft, Database, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function AuctionSamplePage() {

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
      </div>

      {/* Demo Notice */}
      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-6 py-4 rounded-lg">
        <div className="flex items-center">
          <Database className="w-5 h-5 mr-2" />
          <div>
            <h3 className="font-semibold">Demo Environment</h3>
            <p className="text-sm mt-1">
              This is a sample auction detail page. To view real auction data, you need to configure Supabase and deploy the application.
            </p>
          </div>
        </div>
      </div>

      {/* Sample Auction Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Sample Transport Auction
            </h1>
            <p className="text-gray-600 mb-4">
              Transport goods from Mumbai to Delhi via truck. This is a sample auction to demonstrate the interface.
            </p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <span>Created: January 15, 2024</span>
              </div>
              <div className="flex items-center">
                <span>Ends: January 20, 2024</span>
              </div>
              <div className="flex items-center">
                <span>Job Date: January 25, 2024</span>
              </div>
            </div>
          </div>
          <div className="ml-6">
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Active
            </span>
          </div>
        </div>
      </div>

      {/* Sample Data Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Consigner Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Consigner</h3>
          <div className="space-y-2">
            <p className="font-medium text-gray-900">John Logistics</p>
            <p className="text-sm text-gray-500">@johnlogistics</p>
            <p className="text-sm text-gray-600">john@example.com</p>
            <p className="text-sm text-gray-600">+91 98765 43210</p>
          </div>
        </div>

        {/* Winner Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Winner</h3>
          <div className="space-y-2">
            <p className="font-medium text-green-700">Fast Transport Co.</p>
            <p className="text-sm text-gray-500">@fasttransport</p>
            <p className="text-sm text-gray-600">MH12AB1234</p>
            <p className="text-sm text-gray-600">+91 87654 32109</p>
            <p className="text-lg font-bold text-green-700">₹45,000</p>
          </div>
        </div>

        {/* Bid Statistics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Bid Stats</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">Total Bids</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Lowest Bid</p>
              <p className="text-lg font-semibold text-green-700">₹42,000</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Highest Bid</p>
              <p className="text-lg font-semibold text-red-700">₹58,000</p>
            </div>
          </div>
        </div>

        {/* Job Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Job Details</h3>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-600">Pickup</p>
              <p className="text-sm font-medium text-gray-900">Mumbai, Maharashtra</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Drop-off</p>
              <p className="text-sm font-medium text-gray-900">Delhi, NCR</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Distance</p>
              <p className="text-sm font-medium text-gray-900">1,400 km</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Weight</p>
              <p className="text-sm font-medium text-gray-900">2,500 kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-4 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Setup Required</h3>
            <p className="text-sm mt-1">
              To use this admin portal with real data, you need to:
            </p>
            <ul className="text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Set up a Supabase project</li>
              <li>Configure environment variables</li>
              <li>Deploy to a hosting platform that supports server-side features</li>
            </ul>
            <a
              href="https://github.com/AiravatL/AiravatL-admin#setup"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 mt-2"
            >
              View Setup Instructions <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
