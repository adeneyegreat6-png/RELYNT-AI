import { requireUser, errorResponse } from "@/lib/auth";
import { disconnectGoogle } from "@/lib/integrations/google";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Deletes the account and everything attached to it (tables cascade on user).
export async function POST() {
  try {
    const user = await requireUser();
    await disconnectGoogle(user.id);
    const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
    if (error) throw error;
    await (await createClient()).auth.signOut();
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
