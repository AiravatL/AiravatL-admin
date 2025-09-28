import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseAdminAvailable } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Check if service role key is available
    if (!isSupabaseAdminAvailable()) {
      console.error('Service role key not available in environment');
      return NextResponse.json(
        {
          error: 'Admin service not configured. Please set SUPABASE_SERVICE_ROLE_KEY environment variable.',
          details: 'This feature requires admin privileges to create auctions.'
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      from,
      to,
      description,
      weight,
      weightUnit,
      vehicleType,
      duration,
      consignmentDate,
      lengthValue,
      lengthUnit,
      bodyType,
      wheelType
    } = body;

    // Validate required fields
    const errors = [];
    if (!from?.trim()) errors.push('Pickup location is required');
    if (!to?.trim()) errors.push('Destination is required');
    if (!description?.trim()) errors.push('Description is required');
    if (!weight?.trim()) errors.push('Weight is required');
    if (!vehicleType) errors.push('Vehicle type is required');
    if (!duration) errors.push('Duration is required');
    if (!consignmentDate) errors.push('Consignment date is required');

    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) {
      errors.push('Please enter a valid weight');
    }

    if (duration < 5) {
      errors.push('Duration must be at least 5 minutes');
    }

    if (duration > 7 * 24 * 60) {
      errors.push('Duration cannot exceed 7 days');
    }

    // Validate dates
    const consignmentDateObj = new Date(consignmentDate);
    const now = new Date();

    // Compare dates only (not times) for admin flexibility
    const consignmentDateOnly = new Date(consignmentDateObj.getFullYear(), consignmentDateObj.getMonth(), consignmentDateObj.getDate());
    const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (consignmentDateOnly < todayOnly) {
      errors.push('Consignment date cannot be in the past');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation errors: ' + errors.join(', ') },
        { status: 400 }
      );
    }

    console.log('Admin API: Creating auction with data:', body);

    // Find the admin consigner profile (phone number 7099220645) with optimized query
    const { data: adminConsigner, error: consignerError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, phone_number, role')
      .eq('phone_number', '7099220645')
      .eq('role', 'consigner')
      .limit(1)
      .single();

    if (consignerError || !adminConsigner) {
      console.error('Error finding admin consigner:', consignerError);
      return NextResponse.json(
        {
          error: 'Admin consigner profile not found. Please ensure profile with phone number 7099220645 exists with role "consigner".',
          details: consignerError?.message
        },
        { status: 404 }
      );
    }

    // Calculate auction times
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    // Vehicle type and body type mappings (optimized)
    const vehicleTypeMap = {
      "three_wheeler": "Three Wheeler",
      "pickup_truck": "Pickup Truck",
      "mini_truck": "Mini Truck",
      "medium_truck": "Medium Truck",
      "large_truck": "Large Truck"
    };

    const bodyTypeMap = {
      "container": "Container",
      "top_open": "Top Open",
      "trailer": "Trailer"
    };

    // Build description with all details (optimized string building)
    const descriptionParts = [
      description,
      `Weight: ${weight} ${weightUnit}`,
      `Vehicle Type: ${vehicleTypeMap[vehicleType as keyof typeof vehicleTypeMap] || vehicleType}`
    ];

    if (lengthValue) {
      descriptionParts.push(`Length: ${lengthValue} ${lengthUnit}`);
    }

    if (bodyType && bodyType !== "top_open") {
      descriptionParts.push(`Body Type: ${bodyTypeMap[bodyType as keyof typeof bodyTypeMap] || bodyType}`);
    }

    if (vehicleType === "large_truck" && wheelType && wheelType !== 4) {
      descriptionParts.push(`Wheel Type: ${wheelType} Wheeler`);
    }

    const fullDescription = descriptionParts.join('\n');

    // Prepare auction data
    const auctionData = {
      title: `Delivery from ${from} to ${to}`,
      description: fullDescription,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      created_by: adminConsigner.id,
      vehicle_type: vehicleType,
      consignment_date: consignmentDateObj.toISOString(),
      status: 'active',
      // Add optional fields only if they have values
      ...(lengthValue && {
        length_value: parseFloat(lengthValue),
        length_unit: lengthUnit || 'meter',
      }),
      ...(bodyType && bodyType !== "top_open" && { body_type: bodyType }),
      ...(vehicleType === "large_truck" && wheelType && wheelType !== 4 && { wheel_type: wheelType }),
    };

    // Create the auction and audit log in parallel for better performance
    const { data: createdAuction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .insert(auctionData)
      .select('id, title, status, created_at, start_time, end_time')
      .single();

    if (auctionError) {
      console.error('Error creating auction:', auctionError);
      return NextResponse.json(
        { error: 'Failed to create auction: ' + auctionError.message },
        { status: 500 }
      );
    }

    // Create audit log asynchronously (don't wait for response)
    supabaseAdmin.from('auction_audit_logs').insert({
      auction_id: createdAuction.id,
      user_id: null,
      action: 'Auction created via admin dashboard',
      details: {
        created_by: 'admin',
        consigner_id: adminConsigner.id,
        consigner_phone: '7099220645',
        timestamp: new Date().toISOString(),
        auction_data: { ...auctionData, id: createdAuction.id },
      },
    }).then(result => {
      if (result.error) {
        console.error('Audit log creation failed:', result.error);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Auction created successfully',
      auction: createdAuction,
      consigner: adminConsigner,
      duration_minutes: duration
    });

  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}