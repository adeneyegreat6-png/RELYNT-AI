import { z } from "zod";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { assertCanPlan } from "@/lib/usage";
import { getGoogleConnection, listUpcomingEvents } from "@/lib/integrations/google";
import { planRequest, PlannerRefusal } from "@/lib/planner";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTimeZone } from "@/lib/time";
import { REQUIRED_SCOPE } from "@/lib/actions";

const Body = z.object({
  request: z.string().trim().min(3, "Tell Relynt what you want done.").max(2000),
  timeZone: z.string().refine(isValidTimeZone, "Unknown time zone."),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
    const { request, timeZone } = parsed.data;

    await assertCanPlan(user.id);

    const conn = await getGoogleConnection(user.id);
    let calendar = null;
    if (conn?.scopes.includes(REQUIRED_SCOPE.create_calendar_event!)) {
      calendar = await listUpcomingEvents(user.id).catch((e) => {
        console.error("calendar read failed", e);
        return null;
      });
    }

    let plan;
    try {
      plan = await planRequest({ request, timeZone, calendar });
    } catch (e) {
      if (e instanceof PlannerRefusal) throw new HttpError(422, e.message);
      throw e;
    }

    const db = createAdminClient();
    const { data: planRow, error: planErr } = await db
      .from("plans")
      .insert({ user_id: user.id, request, summary: plan.summary, questions: plan.questions })
      .select()
      .single();
    if (planErr) throw planErr;

    let actionRows: unknown[] = [];
    if (plan.actions.length) {
      const { data, error } = await db
        .from("actions")
        .insert(
          plan.actions.map((a, i) => ({
            plan_id: planRow.id,
            user_id: user.id,
            position: i,
            type: a.type,
            payload: a.payload,
            reason: a.reason,
          })),
        )
        .select()
        .order("position");
      if (error) throw error;
      actionRows = data;
    }

    await db.from("activity").insert({
      user_id: user.id,
      plan_id: planRow.id,
      event: "plan_created",
      detail: `${plan.actions.length} action(s) proposed`,
    });

    return Response.json({ plan: planRow, actions: actionRows });
  } catch (err) {
    return errorResponse(err);
  }
}
