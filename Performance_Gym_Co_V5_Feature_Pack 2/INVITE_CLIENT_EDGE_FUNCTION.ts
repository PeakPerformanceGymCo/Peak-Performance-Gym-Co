import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST requests only" }), { status: 405, headers: { "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "You must be logged in." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: coachProfile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("id", user.id)
      .single();

    if (profileError || !coachProfile || !["coach", "admin"].includes(coachProfile.role)) {
      return new Response(JSON.stringify({ error: "Only coaches or admins can invite clients." }), { status: 403, headers: { "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const program = String(body.program ?? "").trim();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: "Client name and email are required." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { data: invitedUser, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, role: "client" },
    });

    if (inviteError) {
      return new Response(JSON.stringify({ error: inviteError.message }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const clientAuthId = invitedUser.user?.id;

    if (clientAuthId) {
      const { error: clientProfileError } = await admin.from("profiles").upsert({
        id: clientAuthId,
        full_name: name,
        email,
        role: "client",
      }, { onConflict: "id" });
      if (clientProfileError) console.error("Client profile error:", clientProfileError);
    }

    const { error: inviteRecordError } = await admin.from("pg_client_invites").insert({
      coach_id: user.id,
      client_auth_id: clientAuthId,
      client_name: name,
      client_email: email,
      program_name: program || null,
      status: "pending",
    });

    if (inviteRecordError) console.error("Invite record error:", inviteRecordError);

    return new Response(JSON.stringify({ success: true, message: `Invitation sent to ${email}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
