import CodeLookupForm from "@/components/code-lookup-form";

export default async function EnterTestPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = "" } = await searchParams;
  return <main className="container">
    <section className="page-heading"><p className="eyebrow">Student portal</p><h1>Enter a test code</h1><p>Find the test details first. Published status, access rules, dates and attempt limits are checked again on the server when you start.</p></section>
    <section className="section"><CodeLookupForm initialCode={code} /></section>
  </main>;
}
