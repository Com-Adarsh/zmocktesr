import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOptionalUser } from "@/lib/optional-user";

export type Role = "admin" | "mediator" | "student";

export async function requireRole(allowed: Role[]) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/login?setup=required");

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();
  if (profileError) throw new Error(`Unable to load account permissions: ${profileError.message}`);
  if (!allowed.includes(profile.role as Role)) redirect("/");

  return { supabase, user, profile: profile as { role: Role; display_name: string | null } };
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const user = await getOptionalUser(supabase);
  return user ? { supabase, user } : null;
}
