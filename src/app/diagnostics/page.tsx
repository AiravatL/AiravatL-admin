"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DiagnosticPage() {
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const results: any = {};

    // 1. Check environment variables
    results.supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT SET";
    results.supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10)}...`
      : "NOT SET";

    // 2. Test Supabase connection
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("count")
        .limit(1);
      results.supabaseConnection = error
        ? `Error: ${error.message}`
        : "Connected ✓";
    } catch (err: any) {
      results.supabaseConnection = `Failed: ${err.message}`;
    }

    // 3. Test Auth status
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      results.authSession = session
        ? `Active (${session.user.email})`
        : "No active session";
      results.authError = error ? error.message : "None";
    } catch (err: any) {
      results.authSession = `Error: ${err.message}`;
    }

    // 4. Test basic query
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("email")
        .limit(1);
      results.queryTest = error
        ? `Error: ${error.message}`
        : `Success (${data?.length || 0} rows)`;
    } catch (err: any) {
      results.queryTest = `Failed: ${err.message}`;
    }

    // 5. Test Auth providers
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: "test@test.com",
        password: "wrong-password",
      });
      results.authProviderTest = error
        ? error.message.includes("Invalid login")
          ? "Auth provider working (expected invalid login)"
          : `Auth error: ${error.message}`
        : "Unexpected success";
    } catch (err: any) {
      results.authProviderTest = `Failed: ${err.message}`;
    }

    // 6. Network info
    results.browserOnline = navigator.onLine ? "Yes" : "No";
    results.protocol = window.location.protocol;
    results.hostname = window.location.hostname;

    setDiagnostics(results);
    setLoading(false);
  };

  const testLogin = async () => {
    const email = prompt("Enter admin email:");
    const password = prompt("Enter password:");

    if (!email || !password) return;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(`Login failed: ${error.message}`);
      } else {
        alert(`Login successful! User: ${data.user?.email}`);
        window.location.reload();
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AiravatL Admin - System Diagnostics
          </h1>
          <p className="text-gray-600">
            Checking backend connectivity and authentication status
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Diagnostic Results
          </h2>

          <div className="space-y-4">
            {Object.entries(diagnostics).map(([key, value]) => (
              <div key={key} className="border-b border-gray-200 pb-3">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-700 capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </span>
                  <span
                    className={`text-sm font-mono ml-4 ${
                      typeof value === "string" && value.includes("Error")
                        ? "text-red-600"
                        : value === "NOT SET"
                        ? "text-orange-600"
                        : typeof value === "string" && value.includes("✓")
                        ? "text-green-600"
                        : "text-gray-900"
                    }`}
                  >
                    {String(value)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>

          <div className="space-y-4">
            <button
              onClick={testLogin}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Test Login
            </button>

            <button
              onClick={runDiagnostics}
              className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Diagnostics
            </button>

            <a
              href="/login"
              className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              Go to Login Page
            </a>
          </div>
        </div>

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Common Issues:</h3>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>
              <strong>Supabase URL NOT SET:</strong> Missing
              NEXT_PUBLIC_SUPABASE_URL in .env.local
            </li>
            <li>
              <strong>Supabase Anon Key NOT SET:</strong> Missing
              NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
            </li>
            <li>
              <strong>Connection Failed:</strong> Network issue or Supabase
              project paused
            </li>
            <li>
              <strong>CORS Error:</strong> Check Supabase Auth settings → Site
              URL configuration
            </li>
            <li>
              <strong>Auth Provider Error:</strong> Email provider might be
              disabled in Supabase dashboard
            </li>
          </ul>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Fix Steps:</h3>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Verify .env.local exists with correct Supabase credentials</li>
            <li>Check Supabase Dashboard → Project Settings → API</li>
            <li>
              Verify Auth → Configuration → Site URL includes your localhost URL
            </li>
            <li>Ensure Auth → Providers → Email is enabled</li>
            <li>Restart dev server after changing .env.local</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
