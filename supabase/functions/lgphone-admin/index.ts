import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile } = await adminClient.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
    if (!callerProfile || callerProfile.role !== "admin") return json({ error: "Admin access required" }, 403);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const body = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};

    if (action === "create_user") {
      const { email, password, full_name, role, can_control, can_power, can_upload, can_view, can_edit } = body;
      if (!email || !password) return json({ error: "Email and password required" }, 400);
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr || !newUser.user) return json({ error: createErr?.message || "Failed" }, 400);
      const { error: profileErr } = await adminClient.from("profiles").insert({
        id: newUser.user.id, email, full_name: full_name || "", role: role || "operator",
        can_control: !!can_control, can_power: !!can_power, can_upload: !!can_upload,
        can_view: can_view !== undefined ? !!can_view : true, can_edit: !!can_edit, is_active: true,
      });
      if (profileErr) return json({ error: profileErr.message }, 400);
      return json({ success: true, user_id: newUser.user.id });
    }

    if (action === "update_user") {
      const { user_id, full_name, role, can_control, can_power, can_upload, can_view, can_edit, is_active } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const updates: Record<string, unknown> = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (role !== undefined) updates.role = role;
      if (can_control !== undefined) updates.can_control = can_control;
      if (can_power !== undefined) updates.can_power = can_power;
      if (can_upload !== undefined) updates.can_upload = can_upload;
      if (can_view !== undefined) updates.can_view = can_view;
      if (can_edit !== undefined) updates.can_edit = can_edit;
      if (is_active !== undefined) updates.is_active = is_active;
      const { error } = await adminClient.from("profiles").update(updates).eq("id", user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) return json({ error: "user_id required" }, 400);
      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "list_users") {
      const { data, error } = await adminClient.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) return json({ error: error.message }, 400);
      return json({ users: data });
    }

    if (action === "seed_admin") {
      const { email, password, full_name } = body;
      if (!email || !password) return json({ error: "Email and password required" }, 400);
      const { data: existingAdmin } = await adminClient.from("profiles").select("id").eq("role", "admin").maybeSingle();
      if (existingAdmin) return json({ error: "Admin already exists" }, 400);
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true });
      if (createErr || !newUser.user) return json({ error: createErr?.message || "Failed" }, 400);
      await adminClient.from("profiles").insert({ id: newUser.user.id, email, full_name: full_name || "Administrator", role: "admin", can_control: true, can_power: true, can_upload: true, can_view: true, can_edit: true, is_active: true });
      return json({ success: true, user_id: newUser.user.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
