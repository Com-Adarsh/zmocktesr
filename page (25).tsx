import { Suspense } from "react";
import AuthForm from "@/components/auth-form";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Account access</p><h1>Sign in to continue</h1><p>Student accounts can be created here. Mediator and administrator access is invitation-only.</p></section>
    <Suspense fallback={<p>Loading sign-in form…</p>}><AuthForm /></Suspense>
    <Suspense fallback={null}><SetupNotice searchParams={searchParams} /></Suspense>
  </main>;
}

async function SetupNotice({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
  return setup === "required" ? <p className="notice" style={{ marginTop: 20 }}>Sign-in is not configured. Add the Supabase project URL and public key to the deployment environment.</p> : null;
}
