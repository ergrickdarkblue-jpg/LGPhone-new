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
    const { data: profile } = await adminClient.from("profiles").select("role, can_control, can_power, can_upload, can_view, can_edit").eq("id", userData.user.id).maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 403);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const body = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};
    const isAdmin = profile.role === "admin";

    if (action === "create_user") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { email, password, full_name, role, can_control, can_power, can_upload, can_view, can_edit } = body;
      const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createErr) return json({ error: createErr.message }, 400);
      const { error: profileErr } = await adminClient.from("profiles").insert({
        id: newUser.user.id, email, full_name: full_name || "",
        role: role || "operator",
        can_control: !!can_control, can_power: !!can_power, can_upload: !!can_upload,
        can_view: can_view !== false, can_edit: !!can_edit, is_active: true,
      });
      if (profileErr) return json({ error: profileErr.message }, 400);
      return json({ success: true });
    }

    if (action === "update_user") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { user_id, full_name, role, can_control, can_power, can_upload, can_view, can_edit, is_active } = body;
      const { error: updateErr } = await adminClient.from("profiles").update({
        full_name, role, can_control: !!can_control, can_power: !!can_power,
        can_upload: !!can_upload, can_view: !!can_view, can_edit: !!can_edit, is_active: is_active !== false,
      }).eq("id", user_id);
      if (updateErr) return json({ error: updateErr.message }, 400);
      return json({ success: true });
    }

    if (action === "register_app") {
      if (!profile.can_upload && !isAdmin) return json({ error: "No upload permission" }, 403);
      const { filename, file_path, file_size, package_name, is_system, device_id } = body;
      const { data, error } = await adminClient.from("app_files").insert({
        filename, file_path, file_size: file_size || 0, package_name: package_name || null,
        is_system: !!is_system, device_id: device_id || null, uploaded_by: userData.user.id,
      }).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, app: data });
    }

    if (action === "assign_device") {
      if (!profile.can_control && !isAdmin) return json({ error: "No control permission" }, 403);
      const { device_id } = body;
      const { error } = await adminClient.from("devices").update({ assigned_to: userData.user.id, status: "online" }).eq("id", device_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "release_device") {
      const { device_id } = body;
      const { error } = await adminClient.from("devices").update({ assigned_to: null, status: "offline" }).eq("id", device_id).eq("assigned_to", userData.user.id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    if (action === "power_device") {
      if (!profile.can_power && !isAdmin) return json({ error: "No power permission" }, 403);
      const { device_id, power_state } = body;
      const newStatus = power_state === "on" ? "online" : "offline";
      const updateData: Record<string, unknown> = { status: newStatus };
      if (power_state === "off") updateData.assigned_to = null;
      const { error } = await adminClient.from("devices").update(updateData).eq("id", device_id);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true, status: newStatus });
    }

    if (action === "reset_device") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { device_serial } = body;
      await adminClient.from("device_commands").insert({
        device_serial, command_type: "reset", command_data: {}, status: "pending", priority: 10,
      });
      const { data: device } = await adminClient.from("devices").select("id").eq("serial", device_serial).maybeSingle();
      if (device) {
        await adminClient.from("app_files").delete().eq("device_id", device.id).eq("is_system", false);
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }

  function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
