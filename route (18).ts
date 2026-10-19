import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Enter a test code." }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("lookup_test", { p_test_code: code });
  if (error) return NextResponse.json({ error: "Unable to look up this test right now." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "No published test is currently available for that code." }, { status: 404 });
  return NextResponse.json({ test: data[0] });
}
