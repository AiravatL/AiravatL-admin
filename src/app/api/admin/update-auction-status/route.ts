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
          details: 'This feature requires admin privileges to update auction status.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { auctionId, status } = body;

    if (!auctionId || !status) {
      return NextResponse.json(
        { error: 'Missing auctionId or status' },
        { status: 400 }
      );
    }

    // Validate status values
    const allowedStatuses = ['active', 'completed', 'cancelled', 'incomplete'];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('Admin API: Updating auction status:', auctionId, 'to:', status);

    // Get current auction data for audit log
    const { data: currentAuction, error: fetchError } = await supabaseAdmin
      .from('auctions')
      .select('*')
      .eq('id', auctionId)
      .single();

    if (fetchError) {
      console.error('Error fetching auction:', fetchError);
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    const previousStatus = currentAuction.status;

    // Special handling for cancelled auctions
    let additionalUpdates: any = {
      status: status,
      updated_at: new Date().toISOString(),
    };

    // If cancelling an auction, clear winner information
    if (status === 'cancelled') {
      additionalUpdates.winner_id = null;
      additionalUpdates.winning_bid_id = null;
    }

    // Update the auction status
    const { data: updatedAuction, error: updateError } = await supabaseAdmin
      .from('auctions')
      .update(additionalUpdates)
      .eq('id', auctionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating auction status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update auction status: ' + updateError.message },
        { status: 500 }
      );
    }

    // Create audit log
    await supabaseAdmin.from('auction_audit_logs').insert({
      auction_id: auctionId,
      user_id: null,
      action: `Auction status changed from ${previousStatus} to ${status}`,
      details: {
        previous_status: previousStatus,
        new_status: status,
        changed_by: 'admin',
        timestamp: new Date().toISOString(),
        cleared_winner: status === 'cancelled' && (currentAuction.winner_id || currentAuction.winning_bid_id),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Auction status updated to ${status}`,
      updatedAuction,
      previousStatus,
      newStatus: status
    });

  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}