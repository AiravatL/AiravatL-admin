import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase';

export async function PUT(request: NextRequest) {
  try {
    // Check if service role key is available
    if (!isSupabaseAdminAvailable()) {
      console.error('Service role key not available in environment');
      return NextResponse.json(
        {
          error: 'Admin service not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.',
          details: 'This feature requires admin privileges to update bids.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { bidId, auctionId, newAmount } = body;

    if (!bidId || !auctionId || !newAmount) {
      return NextResponse.json(
        { error: 'Missing bidId, auctionId, or newAmount' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const amount = parseFloat(newAmount);
    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Bid amount must be greater than 0' },
        { status: 400 }
      );
    }

    console.log('Admin API: Updating bid:', bidId, 'with new amount:', amount);

    // Get current bid data for audit log
    const { data: currentBid, error: fetchError } = await supabaseAdmin
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
      .select('winning_bid_id, winner_id, lowest_bid_amount, highest_bid_amount')
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
    const oldAmount = parseFloat(currentBid.amount);

    // Update the bid amount
    const { data: updatedBid, error: updateError } = await supabaseAdmin
      .from('auction_bids')
      .update({
        amount: amount
      })
      .eq('id', bidId)
      .select('*, profiles!auction_bids_user_id_fkey(*)')
      .single();

    if (updateError) {
      console.error('Error updating bid:', updateError);
      return NextResponse.json(
        { error: 'Failed to update bid: ' + updateError.message },
        { status: 500 }
      );
    }

    // If this was the winning bid and the amount changed, we might need to recalculate the winner
    // For now, we'll just log it - the admin can manually manage winners if needed
    let winnerUpdateNeeded = false;
    if (isWinningBid) {
      // Get all bids for this auction to find the new lowest
      const { data: allBids, error: bidsError } = await supabaseAdmin
        .from('auction_bids')
        .select('id, amount, user_id')
        .eq('auction_id', auctionId)
        .order('amount', { ascending: true });

      if (!bidsError && allBids && allBids.length > 0) {
        const lowestBid = allBids[0];

        // If the updated bid is no longer the lowest, we need to update the winner
        if (lowestBid.id !== bidId) {
          winnerUpdateNeeded = true;

          const { error: winnerUpdateError } = await supabaseAdmin
            .from('auctions')
            .update({
              winner_id: lowestBid.user_id,
              winning_bid_id: lowestBid.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', auctionId);

          if (winnerUpdateError) {
            console.error('Error updating auction winner:', winnerUpdateError);
          }
        }
      }
    }

    // Update auction bid statistics
    const { data: bidStats } = await supabaseAdmin
      .from('auction_bids')
      .select('amount')
      .eq('auction_id', auctionId);

    if (bidStats && bidStats.length > 0) {
      const amounts = bidStats.map(b => parseFloat(b.amount));
      const lowestAmount = Math.min(...amounts);
      const highestAmount = Math.max(...amounts);

      await supabaseAdmin
        .from('auctions')
        .update({
          lowest_bid_amount: lowestAmount,
          highest_bid_amount: highestAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', auctionId);
    }

    // Create audit log
    await supabaseAdmin.from('auction_audit_logs').insert({
      auction_id: auctionId,
      user_id: null,
      action: 'Bid amount updated via admin API',
      details: {
        bid_id: bidId,
        user: currentBid.profiles?.username,
        amount_changed_from: oldAmount,
        amount_changed_to: amount,
        was_winning_bid: isWinningBid,
        winner_update_needed: winnerUpdateNeeded,
        updated_by: 'admin',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Bid updated successfully',
      updatedBid: {
        id: bidId,
        oldAmount: oldAmount,
        newAmount: amount,
        user: currentBid.profiles?.username,
        wasWinning: isWinningBid,
        winnerUpdateNeeded
      }
    });

  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}