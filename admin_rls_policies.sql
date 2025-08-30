-- SQL to create admin RLS policies
-- Run this in your Supabase SQL Editor

-- First, create a helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin_user() 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE admin_users.email = auth.email()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RLS policy to allow admin users to view all profiles
CREATE POLICY "Admin users can view all profiles" ON public.profiles
    FOR SELECT TO public
    USING (public.is_admin_user());

-- Create RLS policy to allow admin users to view all auctions  
CREATE POLICY "Admin users can view all auctions" ON public.auctions
    FOR SELECT TO public
    USING (public.is_admin_user());

-- Create RLS policy to allow admin users to view all auction bids
CREATE POLICY "Admin users can view all auction_bids" ON public.auction_bids
    FOR SELECT TO public
    USING (public.is_admin_user());

-- Create RLS policy to allow admin users to view all notifications
CREATE POLICY "Admin users can view all auction_notifications" ON public.auction_notifications
    FOR SELECT TO public
    USING (public.is_admin_user());

-- Create RLS policy to allow admin users to view all audit logs
CREATE POLICY "Admin users can view all auction_audit_logs" ON public.auction_audit_logs
    FOR SELECT TO public
    USING (public.is_admin_user());

-- Grant execute permission on the helper function
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO anon, authenticated;