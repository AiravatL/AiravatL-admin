import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase';

export async function DELETE(request: NextRequest) {
  try {
    // Check if service role key is available
    if (!isSupabaseAdminAvailable()) {
      console.error('Service role key not available in environment');
      return NextResponse.json(
        { 
          error: 'Admin service not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.',
          details: 'This feature requires admin privileges to delete bids.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { bidId, auctionId } = body;

    if (!bidId || !auctionId) {
      return NextResponse.json(
        { error: 'Missing bidId or auctionId' },
        { status: 400 }
      );
    }

    console.log('Admin API: Deleting bid:', bidId, 'from auction:', auctionId);
    console.log('Environment check - Service role available:', isSupabaseAdminAvailable());

    // Get bid details before deletion
    const { data: bidData, error: fetchError } = await supabaseAdmin
      .from('auction_bids')
      .select('*, profiles!auction_bids_user_id_fkey(*)')
      .eq('id', bidId)
      .single();

    if (fetchError) {
      console.error('Error fetching bid:', fetchError);
      return NextResponse.json(
        { error: 'Bid not found' },
        { status: 404 }
      );
    }

    // Get auction details to check winning bid
    const { data: auctionData, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('winning_bid_id, winner_id')
      .eq('id', auctionId)
      .single();

    if (auctionError) {
      console.error('Error fetching auction:', auctionError);
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    const isWinningBid = auctionData.winning_bid_id === bidId;

    // Delete the bid (admin client bypasses RLS)
    const { error: deleteError } = await supabaseAdmin
      .from('auction_bids')
      .delete()
      .eq('id', bidId);

    if (deleteError) {
      console.error('Error deleting bid:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete bid: ' + deleteError.message },
        { status: 500 }
      );
    }

    // If this was the winning bid, update the auction
    if (isWinningBid) {
      const { error: updateError } = await supabaseAdmin
        .from('auctions')
        .update({
          winner_id: null,
          winning_bid_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auctionId);

      if (updateError) {
        console.error('Error updating auction:', updateError);
        return NextResponse.json(
          { error: 'Bid deleted but failed to update auction: ' + updateError.message },
          { status: 500 }
        );
      }
    }

    // Create audit log
    await supabaseAdmin.from('auction_audit_logs').insert({
      auction_id: auctionId,
      user_id: null,
      action: 'Bid deleted via admin API',
      details: {
        deleted_bid_id: bidId,
        deleted_bid_amount: bidData.amount,
        deleted_bid_user: bidData.profiles?.username,
        was_winning_bid: isWinningBid,
        deleted_by: 'admin',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bid deleted successfully',
      deletedBid: {
        id: bidId,
        amount: bidData.amount,
        user: bidData.profiles?.username,
        wasWinning: isWinningBid,
      },
    });

  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}