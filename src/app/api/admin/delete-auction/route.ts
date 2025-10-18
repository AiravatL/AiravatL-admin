import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const auctionId = searchParams.get("id");

    if (!auctionId) {
      return NextResponse.json(
        { error: "Auction ID is required" },
        { status: 400 }
      );
    }

    // Verify the auction exists (use admin client to bypass RLS)
    const { data: auction, error: auctionError } = await supabaseAdmin
      .from("auctions")
      .select("id, title")
      .eq("id", auctionId)
      .single();

    if (auctionError || !auction) {
      return NextResponse.json(
        { error: "Auction not found" },
        { status: 404 }
      );
    }

    // Step 1: Clear winning_bid_id to avoid foreign key constraint when deleting bids
    const { error: clearWinningBidError } = await supabaseAdmin
      .from("auctions")
      .update({ winning_bid_id: null })
      .eq("id", auctionId);

    if (clearWinningBidError) {
      console.error("Error clearing winning_bid_id:", clearWinningBidError);
      return NextResponse.json(
        { error: "Failed to clear winning bid reference: " + clearWinningBidError.message },
        { status: 500 }
      );
    }

    // Step 2: Delete notifications related to this auction
    const { error: notificationsError } = await supabaseAdmin
      .from("auction_notifications")
      .delete()
      .eq("auction_id", auctionId);

    if (notificationsError) {
      console.error("Error deleting auction notifications:", notificationsError);
      return NextResponse.json(
        { error: "Failed to delete auction notifications: " + notificationsError.message },
        { status: 500 }
      );
    }

    // Step 3: Delete audit logs related to this auction
    const { error: auditLogsError } = await supabaseAdmin
      .from("auction_audit_logs")
      .delete()
      .eq("auction_id", auctionId);

    if (auditLogsError) {
      console.error("Error deleting auction audit logs:", auditLogsError);
      return NextResponse.json(
        { error: "Failed to delete auction audit logs: " + auditLogsError.message },
        { status: 500 }
      );
    }

    // Step 4: Delete all bids for this auction (now safe because winning_bid_id is cleared)
    const { error: bidsError } = await supabaseAdmin
      .from("auction_bids")
      .delete()
      .eq("auction_id", auctionId);

    if (bidsError) {
      console.error("Error deleting bids:", bidsError);
      return NextResponse.json(
        { error: "Failed to delete bids: " + bidsError.message },
        { status: 500 }
      );
    }

    // Step 5: Delete the auction itself
    const { error: auctionDeleteError } = await supabaseAdmin
      .from("auctions")
      .delete()
      .eq("id", auctionId);

    if (auctionDeleteError) {
      console.error("Error deleting auction:", auctionDeleteError);
      return NextResponse.json(
        { error: "Failed to delete auction: " + auctionDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Auction and all related data deleted successfully",
    });
  } catch (error: any) {
    console.error("Error in delete auction API:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
