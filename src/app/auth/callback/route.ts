import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the sign-in email link.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/app", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
