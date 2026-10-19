import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getApiContext(roles: string[] = []) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { response: NextResponse.json({ error: "Supabase is not configured." }, { status: 503 }) };
  }
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    return { response: NextResponse.json({ error: "Unable to verify the current session." }, { status: 401 }) };
  }
  if (!user) return { response: NextResponse.json({ error: "Sign in is required." }, { status: 401 }) };

  if (roles.length) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profileError) return { response: NextResponse.json({ error: "Unable to verify account permissions." }, { status: 403 }) };
    if (!roles.includes(profile.role)) {
      return { response: NextResponse.json({ error: "This account is not allowed to perform that action." }, { status: 403 }) };
    }
  }
  return { supabase, user };
}
