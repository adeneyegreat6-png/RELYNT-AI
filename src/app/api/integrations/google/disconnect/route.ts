import { requireUser, errorResponse } from "@/lib/auth";
import { disconnectGoogle } from "@/lib/integrations/google";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const user = await requireUser();
    await disconnectGoogle(user.id);
    await createAdminClient().from("activity").insert({ user_id: user.id, event: "google_disconnected", detail: "" });
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
