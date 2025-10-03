import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consignerId = searchParams.get("id");

    if (!consignerId) {
      return NextResponse.json(
        { error: "Consigner ID is required" },
        { status: 400 }
      );
    }

    // Verify the user exists and is a consigner
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", consignerId)
      .eq("role", "consigner")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Consigner not found" },
        { status: 404 }
      );
    }

    // Step 1: Get all auctions created by this consigner
    const { data: auctions, error: auctionsQueryError } = await supabaseAdmin
      .from("auctions")
      .select("id")
      .eq("created_by", consignerId);

    if (auctionsQueryError) {
      console.error("Error querying auctions:", auctionsQueryError);
      return NextResponse.json(
        { error: "Failed to query auctions: " + auctionsQueryError.message },
        { status: 500 }
      );
    }

    const auctionIds = auctions?.map(a => a.id) || [];

    // Step 2: Delete notifications related to these auctions
    if (auctionIds.length > 0) {
      const { error: auctionNotificationsError } = await supabaseAdmin
        .from("auction_notifications")
        .delete()
        .in("auction_id", auctionIds);

      if (auctionNotificationsError) {
        console.error("Error deleting auction notifications:", auctionNotificationsError);
        return NextResponse.json(
          { error: "Failed to delete auction notifications: " + auctionNotificationsError.message },
          { status: 500 }
        );
      }
    }

    // Step 3: Delete audit logs related to these auctions
    if (auctionIds.length > 0) {
      const { error: auctionAuditError } = await supabaseAdmin
        .from("auction_audit_logs")
        .delete()
        .in("auction_id", auctionIds);

      if (auctionAuditError) {
        console.error("Error deleting auction audit logs:", auctionAuditError);
        return NextResponse.json(
          { error: "Failed to delete auction audit logs: " + auctionAuditError.message },
          { status: 500 }
        );
      }
    }

    // Step 4: Delete bids on these auctions
    if (auctionIds.length > 0) {
      const { error: bidsError } = await supabaseAdmin
        .from("auction_bids")
        .delete()
        .in("auction_id", auctionIds);

      if (bidsError) {
        console.error("Error deleting bids:", bidsError);
        return NextResponse.json(
          { error: "Failed to delete bids: " + bidsError.message },
          { status: 500 }
        );
      }
    }

    // Step 5: Delete the auctions
    if (auctionIds.length > 0) {
      const { error: auctionsDeleteError } = await supabaseAdmin
        .from("auctions")
        .delete()
        .in("id", auctionIds);

      if (auctionsDeleteError) {
        console.error("Error deleting auctions:", auctionsDeleteError);
        return NextResponse.json(
          { error: "Failed to delete auctions: " + auctionsDeleteError.message },
          { status: 500 }
        );
      }
    }

    // Step 6: Delete notifications for this user
    const { error: userNotificationsError } = await supabaseAdmin
      .from("auction_notifications")
      .delete()
      .eq("user_id", consignerId);

    if (userNotificationsError) {
      console.error("Error deleting user notifications:", userNotificationsError);
      return NextResponse.json(
        { error: "Failed to delete user notifications: " + userNotificationsError.message },
        { status: 500 }
      );
    }

    // Step 7: Delete audit logs for this user
    const { error: userAuditError } = await supabaseAdmin
      .from("auction_audit_logs")
      .delete()
      .eq("user_id", consignerId);

    if (userAuditError) {
      console.error("Error deleting user audit logs:", userAuditError);
      return NextResponse.json(
        { error: "Failed to delete user audit logs: " + userAuditError.message },
        { status: 500 }
      );
    }

    // Step 8: Clear winner_id references to this consigner
    const { error: clearWinnerError } = await supabaseAdmin
      .from("auctions")
      .update({ winner_id: null })
      .eq("winner_id", consignerId);

    if (clearWinnerError) {
      console.error("Error clearing winner references:", clearWinnerError);
      return NextResponse.json(
        { error: "Failed to clear winner references: " + clearWinnerError.message },
        { status: 500 }
      );
    }

    // Step 9: Delete the profile (this allows auth user deletion)
    const { error: profileDeleteError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", consignerId);

    if (profileDeleteError) {
      console.error("Error deleting profile:", profileDeleteError);
      return NextResponse.json(
        { error: "Failed to delete profile: " + profileDeleteError.message },
        { status: 500 }
      );
    }

    // Step 10: Finally delete from auth.users
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(
      consignerId
    );

    if (authDeleteError) {
      console.error("Error deleting auth user:", authDeleteError);
      return NextResponse.json(
        { error: "Failed to delete consigner account: " + authDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Consigner and all related data deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete consigner API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
