"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    try {
      const { error } = await createBrowserClient(url, key).auth.signOut();
      if (error) window.alert(`Sign out failed: ${error.message}`);
      else router.push("/");
    } catch {
      window.alert("Sign out could not reach Supabase. Try again when the connection is available.");
    }
  }
  return <button type="button" className="button secondary" onClick={signOut}>Sign out</button>;
}
