import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Initialize Supabase Admin Client
        // The Service Role Key allows this client to bypass RLS and perform Admin actions.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 2. Verify Caller Validity (Authentication)
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Missing Authorization header')

        // Get the user from the JWT sent by the frontend
        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

        if (userError || !user) {
            throw new Error('Invalid Token')
        }

        // 3. Verify Caller Permissions (Authorization)
        // Query the public.user_roles table to ensure the caller is an 'admin'
        const { data: roleData, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('email', user.email) // Match by email or ID depending on your schema
            .single()

        if (roleError || roleData?.role !== 'admin') {
            return new Response(
                JSON.stringify({ error: 'Forbidden: You must be an Admin to invite users.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
            )
        }

        // 4. Parse Request Body
        const { email, role } = await req.json()
        if (!email) throw new Error('Email is required')

        // 5. Execute Admin Action: Invite User
        // This sends the standard Supabase Invite Email to the user.
        const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)

        if (inviteError) {
            // Handle "User already registered" gracefully if needed
            throw inviteError
        }

        // 6. Sync with user_roles table
        // We upsert the new user's ID and Role into our public table.
        if (inviteData.user) {
            const { error: dbError } = await supabaseAdmin
                .from('user_roles')
                .upsert({
                    id: inviteData.user.id, // Ideally use the UUID from Auth
                    email: email.toLowerCase(),
                    role: role || 'viewer',
                }, { onConflict: 'email' }) // fallback to email matching if ID differs

            if (dbError) {
                console.error("Database Error:", dbError)
                throw new Error(`User invited but failed to assign role: ${dbError.message}`)
            }
        }

        // 7. Success Response
        return new Response(
            JSON.stringify({
                success: true,
                message: `Invitation sent to ${email}`,
                user: inviteData.user
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
        )
    }
})
