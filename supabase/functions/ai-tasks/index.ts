import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, can_control")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile) return json({ error: "Profile not found" }, 403);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const method = req.method;
    const body = method === "POST" || method === "PUT" ? await req.json().catch(() => ({})) : {};
    const isAdmin = profile.role === "admin";
    const canControl = profile.can_control || isAdmin;

    // ── GET: list templates or tasks ──────────────────────────────────────────
    if (method === "GET" && action === "templates") {
      const { data, error } = await adminClient
        .from("ai_templates")
        .select("*")
        .order("is_system", { ascending: false })
        .order("name", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ templates: data });
    }

    if (method === "GET" && action === "tasks") {
      const deviceId = url.searchParams.get("device_id");
      const status = url.searchParams.get("status");
      let query = adminClient.from("ai_tasks").select("*").order("created_at", { ascending: false }).limit(100);
      if (deviceId) query = query.eq("device_id", deviceId);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ tasks: data });
    }

    // ── POST: create task (and optionally dispatch to device) ──────────────────
    if (method === "POST" && action === "create_task") {
      if (!canControl) return json({ error: "No control permission" }, 403);
      const { device_id, template_id, task_type, task_name, config } = body;
      if (!device_id) return json({ error: "Missing device_id" }, 400);
      if (!task_type) return json({ error: "Missing task_type" }, 400);

      // Resolve template defaults if template_id provided
      let finalConfig = config || {};
      let finalName = task_name || "";
      if (template_id) {
        const { data: tpl } = await adminClient
          .from("ai_templates")
          .select("default_config, name")
          .eq("id", template_id)
          .maybeSingle();
        if (tpl) {
          finalConfig = { ...tpl.default_config, ...finalConfig };
          if (!finalName) finalName = tpl.name;
        }
      }

      const loops = finalConfig.loop || 10;

      const { data: task, error } = await adminClient
        .from("ai_tasks")
        .insert({
          device_id,
          template_id: template_id || null,
          task_type,
          task_name: finalName || task_type,
          config: { ...finalConfig, serial: device_id },
          status: "pending",
          total_loops: loops,
          created_by: userData.user.id,
        })
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);

      // Queue command to device via system_settings (same pattern as lgphone-control)
      await adminClient.from("system_settings").upsert({
        key: `ai_cmd_${device_id}_${task!.id}`,
        value: JSON.stringify({
          type: "ai_task",
          task_id: task!.id,
          task_type,
          config: { ...finalConfig, serial: device_id },
          timestamp: Date.now(),
        }),
        updated_by: userData.user.id,
      });

      return json({ task });
    }

    // ── POST: batch create tasks across multiple devices ───────────────────────
    if (method === "POST" && action === "batch_create") {
      if (!canControl) return json({ error: "No control permission" }, 403);
      const { device_ids, template_id, task_type, task_name, config } = body;
      if (!device_ids || !Array.isArray(device_ids) || device_ids.length === 0)
        return json({ error: "Missing device_ids array" }, 400);

      let finalConfig = config || {};
      let finalName = task_name || "";
      if (template_id) {
        const { data: tpl } = await adminClient
          .from("ai_templates")
          .select("default_config, name")
          .eq("id", template_id)
          .maybeSingle();
        if (tpl) {
          finalConfig = { ...tpl.default_config, ...finalConfig };
          if (!finalName) finalName = tpl.name;
        }
      }

      const loops = finalConfig.loop || 10;
      const rows = device_ids.map((did: string) => ({
        device_id: did,
        template_id: template_id || null,
        task_type: task_type || "custom",
        task_name: finalName || task_type || "custom",
        config: { ...finalConfig, serial: did },
        status: "pending" as const,
        total_loops: loops,
        created_by: userData.user.id,
      }));

      const { data: tasks, error } = await adminClient
        .from("ai_tasks")
        .insert(rows)
        .select("*");
      if (error) return json({ error: error.message }, 500);

      // Queue commands for each device
      for (const t of tasks || []) {
        await adminClient.from("system_settings").upsert({
          key: `ai_cmd_${t.device_id}_${t.id}`,
          value: JSON.stringify({
            type: "ai_task",
            task_id: t.id,
            task_type: t.task_type,
            config: t.config,
            timestamp: Date.now(),
          }),
          updated_by: userData.user.id,
        });
      }

      return json({ tasks, count: tasks?.length || 0 });
    }

    // ── POST: create custom template ──────────────────────────────────────────
    if (method === "POST" && action === "create_template") {
      const { name, description, task_type, icon, default_config } = body;
      if (!name || !task_type) return json({ error: "Missing name or task_type" }, 400);
      const { data, error } = await adminClient
        .from("ai_templates")
        .insert({
          name,
          description: description || "",
          task_type,
          icon: icon || "Bot",
          default_config: default_config || {},
          is_system: false,
          created_by: userData.user.id,
        })
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ template: data });
    }

    // ── PUT: update task status/progress (called by agent) ──────────────────────
    if (method === "PUT" && action === "update_task") {
      const { id, status, progress, current_loop, result, error_message } = body;
      if (!id || !status) return json({ error: "Missing id or status" }, 400);
      const update: Record<string, unknown> = { status };
      if (progress !== undefined) update.progress = progress;
      if (current_loop !== undefined) update.current_loop = current_loop;
      if (result !== undefined) update.result = result;
      if (error_message !== undefined) update.error_message = error_message;
      if (status === "running" && !update.started_at) update.started_at = new Date().toISOString();
      if (["completed", "error", "stopped"].includes(status))
        update.completed_at = new Date().toISOString();
      if (status === "completed") update.progress = 100;

      const { data, error } = await adminClient
        .from("ai_tasks")
        .update(update)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ task: data });
    }

    // ── PUT: stop a running task ────────────────────────────────────────────────
    if (method === "PUT" && action === "stop_task") {
      const { id } = body;
      if (!id) return json({ error: "Missing id" }, 400);
      const { data: task } = await adminClient
        .from("ai_tasks")
        .select("device_id, task_type")
        .eq("id", id)
        .maybeSingle();
      if (!task) return json({ error: "Task not found" }, 404);

      // Queue stop command
      await adminClient.from("system_settings").upsert({
        key: `ai_stop_${task.device_id}_${id}`,
        value: JSON.stringify({
          type: "stop_ai",
          task_id: id,
          timestamp: Date.now(),
        }),
        updated_by: userData.user.id,
      });

      const { data, error } = await adminClient
        .from("ai_tasks")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      return json({ task: data });
    }

    // ── DELETE: delete task ─────────────────────────────────────────────────────
    if (method === "DELETE" && action === "delete_task") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);
      const { error } = await adminClient.from("ai_tasks").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    // ── DELETE: delete template (non-system only) ───────────────────────────────
    if (method === "DELETE" && action === "delete_template") {
      const id = url.searchParams.get("id");
      if (!id) return json({ error: "Missing id" }, 400);
      const { data: tpl } = await adminClient
        .from("ai_templates")
        .select("is_system")
        .eq("id", id)
        .maybeSingle();
      if (tpl?.is_system) return json({ error: "Cannot delete system template" }, 400);
      const { error } = await adminClient.from("ai_templates").delete().eq("id", id);
      if (error) return json({ error: error.message }, 500);
      return json({ success: true });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
