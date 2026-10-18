import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { signState } from "@/lib/crypto";
import { googleAuthUrl } from "@/lib/integrations/google";

export async function GET() {
  const user = await getUser();
  if (!user) redirect("/login");
  redirect(googleAuthUrl(signState(user.id)));
}
