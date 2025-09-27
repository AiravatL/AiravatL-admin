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
          details: 'This feature requires admin privileges to update auctions.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { auctionId, updates } = body;

    if (!auctionId) {
      return NextResponse.json(
        { error: 'Missing auctionId' },
        { status: 400 }
      );
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    console.log('Admin API: Updating auction:', auctionId, 'with updates:', updates);

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

    // Validate the updates against allowed fields
    const allowedFields = [
      'title', 'description', 'vehicle_type', 'start_time', 'end_time',
      'consignment_date', 'length_value', 'length_unit', 'body_type', 'wheel_type'
    ];

    const validUpdates: any = {};
    const auditDetails: any = { changes: {} };

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        // Special validation for date fields - compare dates only for admin flexibility
        if (key === 'consignment_date' || key === 'end_time') {
          const dateValue = new Date(value as string);
          const now = new Date();

          // Compare dates only (not times) for past validation to allow admin flexibility
          const dateOnly = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
          const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          if (key === 'consignment_date' && dateOnly < todayOnly) {
            return NextResponse.json(
              { error: 'Consignment date cannot be in the past' },
              { status: 400 }
            );
          }

          if (key === 'end_time' && dateOnly < todayOnly) {
            return NextResponse.json(
              { error: 'Auction end time cannot be in the past' },
              { status: 400 }
            );
          }
        }

        validUpdates[key] = value;
        auditDetails.changes[key] = {
          from: currentAuction[key],
          to: value
        };
      }
    }

    // Cross-field validation for end_time vs consignment_date
    // Compare only dates, not times - auction should end before consignment date
    if (validUpdates.end_time && validUpdates.consignment_date) {
      const endTime = new Date(validUpdates.end_time);
      const consignmentDate = new Date(validUpdates.consignment_date);

      const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
      const consignmentDateOnly = new Date(consignmentDate.getFullYear(), consignmentDate.getMonth(), consignmentDate.getDate());

      if (endDate > consignmentDateOnly) {
        return NextResponse.json(
          { error: 'Auction must end before or on the consignment date' },
          { status: 400 }
        );
      }
    } else if (validUpdates.end_time && currentAuction.consignment_date) {
      const endTime = new Date(validUpdates.end_time);
      const consignmentDate = new Date(currentAuction.consignment_date);

      const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
      const consignmentDateOnly = new Date(consignmentDate.getFullYear(), consignmentDate.getMonth(), consignmentDate.getDate());

      if (endDate > consignmentDateOnly) {
        return NextResponse.json(
          { error: 'Auction must end before or on the consignment date' },
          { status: 400 }
        );
      }
    } else if (validUpdates.consignment_date && currentAuction.end_time) {
      const endTime = new Date(currentAuction.end_time);
      const consignmentDate = new Date(validUpdates.consignment_date);

      const endDate = new Date(endTime.getFullYear(), endTime.getMonth(), endTime.getDate());
      const consignmentDateOnly = new Date(consignmentDate.getFullYear(), consignmentDate.getMonth(), consignmentDate.getDate());

      if (endDate >= consignmentDateOnly) {
        return NextResponse.json(
          { error: 'Consignment date must be after the auction end date' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at timestamp
    validUpdates.updated_at = new Date().toISOString();

    // Update the auction
    const { data: updatedAuction, error: updateError } = await supabaseAdmin
      .from('auctions')
      .update(validUpdates)
      .eq('id', auctionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating auction:', updateError);
      return NextResponse.json(
        { error: 'Failed to update auction: ' + updateError.message },
        { status: 500 }
      );
    }

    // Create audit log
    await supabaseAdmin.from('auction_audit_logs').insert({
      auction_id: auctionId,
      user_id: null,
      action: 'Auction details updated via admin API',
      details: {
        ...auditDetails,
        updated_by: 'admin',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Auction updated successfully',
      updatedAuction,
      updatedFields: Object.keys(validUpdates)
    });

  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}