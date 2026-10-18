import { z } from "zod";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePayload, REQUIRED_SCOPE, ACTION_LABELS, type ActionRow } from "@/lib/actions";
import { getGoogleConnection } from "@/lib/integrations/google";
import { executeAction } from "@/lib/execute";
import { remainingActions } from "@/lib/usage";

const Body = z.object({
  decisions: z
    .array(
      z.object({
        id: z.uuid(),
        decision: z.enum(["approve", "reject"]),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(20),
});

export async function POST(req: Request, ctx: RouteContext<"/api/plans/[id]/execute">) {
  try {
    const user = await requireUser();
    const { id: planId } = await ctx.params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Invalid request.");
    const { decisions } = parsed.data;

    const db = createAdminClient();
    const { data: plan } = await db
      .from("plans")
      .select("id, status")
      .eq("id", planId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!plan) throw new HttpError(404, "Plan not found.");
    if (plan.status !== "proposed") throw new HttpError(409, "This plan has already been handled.");

    const { data: actionData, error } = await db
      .from("actions")
      .select("*")
      .eq("plan_id", planId)
      .eq("user_id", user.id)
      .eq("status", "proposed");
    if (error) throw error;
    const actions = new Map((actionData as ActionRow[]).map((a) => [a.id, a]));

    for (const d of decisions) {
      if (!actions.has(d.id)) throw new HttpError(409, "One of these actions was already handled. Refresh and try again.");
    }

    const approved = decisions.filter((d) => d.decision === "approve");

    // 1. Validate everything before touching any account. All or nothing.
    const conn = approved.length ? await getGoogleConnection(user.id) : null;
    const problems: Record<string, string[]> = {};
    const validated = new Map<string, unknown>();
    for (const d of approved) {
      const action = actions.get(d.id)!;
      const result = validatePayload(action.type, d.payload ?? action.payload);
      const errs = result.ok ? [] : result.errors;
      const scope = REQUIRED_SCOPE[action.type];
      if (scope && !conn) errs.push("Connect your Google account in Settings first.");
      else if (scope && !conn!.scopes.includes(scope)) errs.push(`Google access for ${ACTION_LABELS[action.type].toLowerCase()}s wasn't granted. Reconnect Google in Settings.`);
      if (errs.length) problems[d.id] = errs;
      else if (result.ok) validated.set(d.id, result.payload);
    }
    if (Object.keys(problems).length) {
      return Response.json({ error: "Some actions need fixing before they can run.", problems }, { status: 422 });
    }

    const remaining = await remainingActions(user.id);
    if (approved.length > remaining) {
      throw new HttpError(429, `You have ${remaining} action(s) left this month.`);
    }

    // 2. Rejections.
    for (const d of decisions.filter((d) => d.decision === "reject")) {
      await db.from("actions").update({ status: "rejected" }).eq("id", d.id).eq("status", "proposed");
      await db.from("activity").insert({ user_id: user.id, plan_id: planId, action_id: d.id, event: "action_rejected", detail: "" });
    }

    // 3. Execute approved actions one by one. The conditional update is the
    // idempotency guard: a double-click or retry can't run an action twice.
    for (const d of approved) {
      const action = actions.get(d.id)!;
      const payload = validated.get(d.id);
      const { data: claimed } = await db
        .from("actions")
        .update({ status: "executing", payload, executed_at: new Date().toISOString() })
        .eq("id", d.id)
        .eq("status", "proposed")
        .select("id");
      if (!claimed?.length) continue;

      await db.from("activity").insert({ user_id: user.id, plan_id: planId, action_id: d.id, event: "action_approved", detail: "" });
      try {
        const result = await executeAction(user.id, action.type, payload);
        await db.from("actions").update({ status: "succeeded", result }).eq("id", d.id);
        await db.from("activity").insert({ user_id: user.id, plan_id: planId, action_id: d.id, event: "action_succeeded", detail: ACTION_LABELS[action.type] });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("action failed", d.id, message);
        await db.from("actions").update({ status: "failed", error: message.slice(0, 500) }).eq("id", d.id);
        await db.from("activity").insert({ user_id: user.id, plan_id: planId, action_id: d.id, event: "action_failed", detail: message.slice(0, 200) });
      }
    }

    // 4. Anything the user didn't decide on is cancelled; the plan is closed.
    await db.from("actions").update({ status: "cancelled" }).eq("plan_id", planId).eq("status", "proposed");
    await db.from("plans").update({ status: "completed" }).eq("id", planId);

    const { data: final } = await db.from("actions").select("*").eq("plan_id", planId).order("position");
    return Response.json({ actions: final });
  } catch (err) {
    return errorResponse(err);
  }
}
