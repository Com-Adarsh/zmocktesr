import { ExamClient } from "@/components/exam-client";

export default async function ExamPage({ params }: { params: Promise<{ testCode: string }> }) {
  const { testCode } = await params;
  return <ExamClient testCode={decodeURIComponent(testCode).toUpperCase()} />;
}
