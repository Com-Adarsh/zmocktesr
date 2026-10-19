"use client";

import { FormEvent, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthForm() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget, submitter ?? undefined);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("Sign in is unavailable because Supabase is not configured.");
      setBusy(false);
      return;
    }
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const action = String(data.get("action"));
    try {
      const client = createBrowserClient(url, key);
      const result = action === "signup"
        ? await client.auth.signUp({ email, password, options: { data: { display_name: String(data.get("name") ?? "") } } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) setError(result.error.message);
      else if (action === "signup" && !result.data.session) setMessage("Registration created. Check your email to confirm your account before signing in.");
      else {
        const next = searchParams.get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      }
    } catch {
      setError("Authentication could not reach Supabase. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="form" onSubmit={submit}>
    <label>Full name <input name="name" autoComplete="name" /></label>
    <label>Email <input type="email" name="email" required autoComplete="email" /></label>
    <label>Password <input type="password" name="password" required minLength={8} autoComplete="current-password" /></label>
    <div className="role-actions">
      <button className="button" type="submit" name="action" value="signin" disabled={busy}>Sign in</button>
      <button className="button secondary" type="submit" name="action" value="signup" disabled={busy}>Create student account</button>
    </div>
    <p className="form-hint">Public registration creates student accounts only. Mediator and administrator accounts require authorised invitations.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success">{message}</p>}
  </form>;
}
