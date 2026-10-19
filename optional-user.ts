import type { SupabaseClient } from "@supabase/supabase-js";

// Public navigation needs a verified user when present, but does not require login.
export async function getOptionalUser(client: Pick<SupabaseClient, "auth">) {
  const { data: { user }, error } = await client.auth.getUser();
  // Supabase reports this expected state as an error for a fresh browser.
  if (error?.name === "AuthSessionMissingError") return null;
  if (error) throw new Error(`Unable to verify account: ${error.message}`);
  return user;
}
