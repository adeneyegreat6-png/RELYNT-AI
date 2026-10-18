import { requireUser } from "@/lib/auth";
import { getGoogleConnection } from "@/lib/integrations/google";
import { getUsage } from "@/lib/usage";
import { CommandCenter } from "@/components/CommandCenter";

export default async function CommandPage() {
  const user = await requireUser();
  const [conn, usage] = await Promise.all([getGoogleConnection(user.id), getUsage(user.id)]);
  return <CommandCenter googleConnected={!!conn} usage={usage} />;
}
