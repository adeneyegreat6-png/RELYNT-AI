import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { verifyState } from "@/lib/crypto";
import { connectGoogle } from "@/lib/integrations/google";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const user = await getUser();
  if (!user) redirect("/login");

  // The state must be signed by us, unexpired, and for this same user.
  if (!code || !state || verifyState(state) !== user.id) {
    redirect("/app/settings?google=error");
  }

  let ok = true;
  try {
    await connectGoogle(user.id, code);
    await createAdminClient().from("activity").insert({ user_id: user.id, event: "google_connected", detail: "" });
  } catch (e) {
    console.error("google connect failed", e);
    ok = false;
  }
  redirect(`/app/settings?google=${ok ? "connected" : "error"}`);
}
