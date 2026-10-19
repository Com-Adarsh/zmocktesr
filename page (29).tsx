import { requireRole } from "@/lib/auth";
import TestRunner from "@/components/test-runner";

export default async function TestPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  await requireRole(["student"]);
  return <main className="container"><TestRunner attemptId={attemptId} /></main>;
}
