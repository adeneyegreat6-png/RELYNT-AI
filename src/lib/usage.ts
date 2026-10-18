import { createAdminClient } from "@/lib/supabase/admin";
import { HttpError } from "@/lib/auth";

// Free-tier allowances. AI calls cost real money, so these are enforced on the
// server before any model call or execution happens.
export const LIMITS = {
  plansPerMonth: 30,
  actionsPerMonth: 20,
};

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export async function getUsage(userId: string) {
  const db = createAdminClient();
  const since = monthStart();
  const [plans, actions] = await Promise.all([
    db.from("plans").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    db
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["executing", "succeeded", "failed"])
      .gte("executed_at", since),
  ]);
  if (plans.error) throw plans.error;
  if (actions.error) throw actions.error;
  return { plans: plans.count ?? 0, actions: actions.count ?? 0, limits: LIMITS };
}

export async function assertCanPlan(userId: string) {
  const usage = await getUsage(userId);
  if (usage.plans >= LIMITS.plansPerMonth) {
    throw new HttpError(429, `You've used all ${LIMITS.plansPerMonth} plans for this month.`);
  }
}

export async function remainingActions(userId: string): Promise<number> {
  const usage = await getUsage(userId);
  return Math.max(0, LIMITS.actionsPerMonth - usage.actions);
}
