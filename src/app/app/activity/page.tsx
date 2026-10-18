import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACTION_LABELS, type ActionRow, type PlanRow } from "@/lib/actions";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionResult } from "@/components/ActionResult";

function summarise(a: ActionRow): string {
  const p = a.payload as Record<string, unknown>;
  switch (a.type) {
    case "create_calendar_event":
      return `${p.title} · ${new Date(String(p.start)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`;
    case "create_task":
      return String(p.title);
    case "create_email_draft":
      return `${p.subject} → ${(p.to as string[] | undefined)?.join(", ") || "no recipient"}`;
    case "research":
      return String(p.question);
  }
}

export default async function ActivityPage() {
  await requireUser();
  // RLS limits these reads to the signed-in user's rows.
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("id, request, summary, questions, status, created_at, actions(*)")
    .order("created_at", { ascending: false })
    .limit(30);

  const rows = (plans ?? []) as (PlanRow & { actions: ActionRow[] })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-muted">Every plan and what happened to each action.</p>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted">Nothing yet. Make your first plan from Command.</p>}
      {rows.map((plan) => (
        <div key={plan.id} className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{plan.request}</p>
            <time className="text-xs text-muted">
              {new Date(plan.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </time>
          </div>
          <p className="mt-1 text-sm text-muted">{plan.summary}</p>
          {plan.actions.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {plan.actions
                .sort((a, b) => a.position - b.position)
                .map((a) => (
                  <li key={a.id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge status={a.status} />
                      <span className="text-muted">{ACTION_LABELS[a.type]}</span>
                      <span>{summarise(a)}</span>
                    </div>
                    {a.status === "executing" && (
                      <p className="mt-2 text-xs text-warn">
                        This action started but its result wasn&apos;t recorded. Check your Google account before retrying.
                      </p>
                    )}
                    <ActionResult action={a} />
                  </li>
                ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
