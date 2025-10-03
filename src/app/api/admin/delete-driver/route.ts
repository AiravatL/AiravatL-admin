import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get("id");

    if (!driverId) {
      return NextResponse.json(
        { error: "Driver ID is required" },
        { status: 400 }
      );
    }

    // Verify the user exists and is a driver
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", driverId)
      .eq("role", "driver")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: 404 }
      );
    }

    // Step 1: Delete notifications for this user
    const { error: userNotificationsError } = await supabaseAdmin
      .from("auction_notifications")
      .delete()
      .eq("user_id", driverId);

    if (userNotificationsError) {
      console.error("Error deleting user notifications:", userNotificationsError);
      return NextResponse.json(
        { error: "Failed to delete user notifications: " + userNotificationsError.message },
        { status: 500 }
      );
    }

    // Step 2: Delete audit logs for this user
    const { error: userAuditError } = await supabaseAdmin
      .from("auction_audit_logs")
      .delete()
      .eq("user_id", driverId);

    if (userAuditError) {
      console.error("Error deleting user audit logs:", userAuditError);
      return NextResponse.json(
        { error: "Failed to delete user audit logs: " + userAuditError.message },
        { status: 500 }
      );
    }

    // Step 3: Clear winner_id from auctions where this driver won
    const { error: clearWinnerError } = await supabaseAdmin
      .from("auctions")
      .update({ winner_id: null })
      .eq("winner_id", driverId);

    if (clearWinnerError) {
      console.error("Error clearing winner references:", clearWinnerError);
      return NextResponse.json(
        { error: "Failed to clear winner references: " + clearWinnerError.message },
        { status: 500 }
      );
    }

    // Step 4: Get all bids by this driver that are winning bids
    const { data: winningBids, error: winningBidsQueryError } = await supabaseAdmin
      .from("auction_bids")
      .select("id")
      .eq("user_id", driverId)
      .eq("is_winning_bid", true);

    if (winningBidsQueryError) {
      console.error("Error querying winning bids:", winningBidsQueryError);
      return NextResponse.json(
        { error: "Failed to query winning bids: " + winningBidsQueryError.message },
        { status: 500 }
      );
    }

    const winningBidIds = winningBids?.map(b => b.id) || [];

    // Step 5: Clear winning_bid_id from auctions
    if (winningBidIds.length > 0) {
      const { error: clearWinningBidError } = await supabaseAdmin
        .from("auctions")
        .update({ winning_bid_id: null })
        .in("winning_bid_id", winningBidIds);

      if (clearWinningBidError) {
        console.error("Error clearing winning_bid_id:", clearWinningBidError);
        return NextResponse.json(
          { error: "Failed to clear winning bid references: " + clearWinningBidError.message },
          { status: 500 }
        );
      }
    }

    // Step 6: Delete all bids by this driver
    const { error: bidsDeleteError } = await supabaseAdmin
      .from("auction_bids")
      .delete()
      .eq("user_id", driverId);

    if (bidsDeleteError) {
      console.error("Error deleting bids:", bidsDeleteError);
      return NextResponse.json(
        { error: "Failed to delete bids: " + bidsDeleteError.message },
        { status: 500 }
      );
    }

    // Step 7: Delete the profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", driverId);

    if (profileDeleteError) {
      console.error("Error deleting profile:", profileDeleteError);
      return NextResponse.json(
        { error: "Failed to delete profile: " + profileDeleteError.message },
        { status: 500 }
      );
    }

    // Step 8: Finally delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      driverId
    );

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
      return NextResponse.json(
        { error: "Failed to delete driver account: " + authDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Driver and all related data deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete driver API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
