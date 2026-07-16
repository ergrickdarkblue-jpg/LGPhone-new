import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin via anon client
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for all DB operations
    const sc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: adminProfile } = await sc
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!adminProfile || adminProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Chỉ admin mới có quyền này" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const method = req.method;

    // ── GET: list app_users ──────────────────────────────────────────────
    if (method === "GET") {
      const { data, error } = await sc
        .from("app_users")
        .select("id, username, full_name, role, can_control, can_power, can_upload, can_view, can_edit, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ users: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: create user/operator (no Supabase Auth, only app_users) ────
    if (method === "POST") {
      const body = await req.json();
      const { username, password, full_name, role, permissions } = body;

      if (!username || !password) {
        return new Response(JSON.stringify({ error: "Thiếu username hoặc mật khẩu" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (role !== "user" && role !== "operator") {
        return new Response(JSON.stringify({ error: "Role phải là 'user' hoặc 'operator'" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: "Mật khẩu phải có ít nhất 6 ký tự" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const passwordHash = await hashPassword(password);

      // Insert ONLY into app_users — never touches Supabase Auth or profiles
      const { data, error } = await sc
        .from("app_users")
        .insert({
          username: username.trim(),
          password_hash: passwordHash,
          full_name: full_name?.trim() || "",
          role,
          can_control: permissions?.can_control ?? false,
          can_power: permissions?.can_power ?? false,
          can_upload: permissions?.can_upload ?? false,
          can_view: permissions?.can_view ?? true,
          can_edit: permissions?.can_edit ?? false,
          is_active: true,
          created_by: user.id,
        })
        .select("id, username, full_name, role, can_control, can_power, can_upload, can_view, can_edit, is_active, created_at")
        .maybeSingle();

      if (error) {
        const msg = error.code === "23505" ? "Username đã tồn tại" : error.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ user: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PUT: update user ─────────────────────────────────────────────────
    if (method === "PUT") {
      const body = await req.json();
      const { id, full_name, role, permissions, is_active, password } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "Thiếu id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const update: Record<string, unknown> = {};
      if (full_name !== undefined) update.full_name = full_name;
      if (role !== undefined) update.role = role;
      if (is_active !== undefined) update.is_active = is_active;
      if (permissions) {
        if (permissions.can_control !== undefined) update.can_control = permissions.can_control;
        if (permissions.can_power !== undefined) update.can_power = permissions.can_power;
        if (permissions.can_upload !== undefined) update.can_upload = permissions.can_upload;
        if (permissions.can_view !== undefined) update.can_view = permissions.can_view;
        if (permissions.can_edit !== undefined) update.can_edit = permissions.can_edit;
      }
      if (password) {
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Mật khẩu phải có ít nhất 6 ký tự" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        update.password_hash = await hashPassword(password);
      }
      const { data, error } = await sc
        .from("app_users")
        .update(update)
        .eq("id", id)
        .select("id, username, full_name, role, can_control, can_power, can_upload, can_view, can_edit, is_active, created_at")
        .maybeSingle();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ user: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DELETE: delete user ──────────────────────────────────────────────
    if (method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "Thiếu id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await sc.from("app_users").delete().eq("id", id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
