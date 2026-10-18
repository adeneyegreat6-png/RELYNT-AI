"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTION_LABELS, validatePayload, type ActionRow, type PlanRow } from "@/lib/actions";
import { ActionEditor } from "@/components/ActionEditor";
import { ActionResult } from "@/components/ActionResult";
import { StatusBadge } from "@/components/StatusBadge";

type Usage = { plans: number; actions: number; limits: { plansPerMonth: number; actionsPerMonth: number } };
type Decision = "approve" | "reject" | null;
type Draft = { payload: Record<string, unknown>; decision: Decision };

const EXAMPLES = [
  "Find time next week for three 90-minute deep-work blocks and draft an email to my client sam@example.com saying the proposal will be ready Friday.",
  "Add tasks for my product launch: write the announcement, record a demo video, and update the pricing page. Spread them over this week.",
  "Research the best invoicing tools for UK freelancers under £15/month and give me a recommendation.",
];

const ICONS: Record<ActionRow["type"], string> = {
  create_calendar_event: "📅",
  create_task: "☑️",
  create_email_draft: "✉️",
  research: "🔎",
};

export function CommandCenter({ googleConnected, usage }: { googleConnected: boolean; usage: Usage }) {
  const [request, setRequest] = useState("");
  const [answers, setAnswers] = useState("");
  const [planning, setPlanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [serverProblems, setServerProblems] = useState<Record<string, string[]>>({});
  const [finished, setFinished] = useState(false);

  async function makePlan(text: string) {
    setPlanning(true);
    setError(null);
    setFinished(false);
    setServerProblems({});
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planning failed.");
      setPlan(data.plan);
      setActions(data.actions);
      setDrafts(Object.fromEntries((data.actions as ActionRow[]).map((a) => [a.id, { payload: a.payload, decision: null }])));
      setAnswers("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    setServerProblems((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  const problemsFor = (a: ActionRow): string[] => {
    const v = validatePayload(a.type, drafts[a.id]?.payload);
    const local = v.ok ? [] : v.errors;
    if (a.type !== "research" && !googleConnected) local.push("Connect Google in Settings to run this.");
    return [...local, ...(serverProblems[a.id] ?? [])];
  };

  const decided = actions.filter((a) => drafts[a.id]?.decision);
  const approved = actions.filter((a) => drafts[a.id]?.decision === "approve");
  const blocked = approved.some((a) => problemsFor(a).length > 0);

  function approveAllValid() {
    for (const a of actions) if (problemsFor(a).length === 0) update(a.id, { decision: "approve" });
  }

  async function run() {
    if (!plan) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisions: decided.map((a) => ({ id: a.id, decision: drafts[a.id].decision, payload: drafts[a.id].payload })),
        }),
      });
      const data = await res.json();
      if (res.status === 422 && data.problems) {
        setServerProblems(data.problems);
        throw new Error(data.error);
      }
      if (!res.ok) throw new Error(data.error ?? "Execution failed.");
      setActions(data.actions);
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setPlan(null);
    setActions([]);
    setDrafts({});
    setRequest("");
    setFinished(false);
    setError(null);
  }

  const succeeded = actions.filter((a) => a.status === "succeeded").length;
  const failed = actions.filter((a) => a.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">What do you want done?</h1>
          <p className="mt-1 text-sm text-muted">Describe the goal. You&apos;ll approve every step before anything happens.</p>
        </div>
        <div className="text-xs text-muted">
          {usage.plans}/{usage.limits.plansPerMonth} plans · {usage.actions}/{usage.limits.actionsPerMonth} actions this month
        </div>
      </div>

      {!googleConnected && (
        <div className="rounded-xl border border-blue/30 bg-blue/10 p-4 text-sm">
          Connect Google so Relynt can see your calendar and create events, tasks and drafts.{" "}
          <Link href="/app/settings" className="font-medium text-cyan hover:underline">
            Connect now →
          </Link>
        </div>
      )}

      {!plan && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            makePlan(request);
          }}
          className="rounded-2xl border border-line bg-panel p-4"
        >
          <textarea
            rows={4}
            maxLength={2000}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="e.g. Organise next week, find time for three important tasks and prepare an email to my client."
            className="w-full resize-none bg-transparent text-base outline-none placeholder:text-muted/70"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setRequest(ex)}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-blue hover:text-text"
                >
                  {["Plan my week", "Launch tasks", "Research"][i]}
                </button>
              ))}
            </div>
            <button
              disabled={planning || request.trim().length < 3}
              className="brand-gradient rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {planning ? "Planning…" : "Make a plan"}
            </button>
          </div>
        </form>
      )}

      {error && <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">{error}</div>}

      {plan && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted">Your request</div>
            <p className="mt-1 text-sm">{plan.request}</p>
            <div className="mt-4 text-xs font-medium uppercase tracking-wide text-cyan">The plan</div>
            <p className="mt-1">{plan.summary}</p>

            {plan.questions.length > 0 && !finished && (
              <div className="mt-4 rounded-xl bg-panel-2 p-4">
                <div className="text-sm font-medium">Relynt has a few questions</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                  {plan.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
                <textarea
                  rows={2}
                  className="field mt-3"
                  placeholder="Your answers…"
                  value={answers}
                  onChange={(e) => setAnswers(e.target.value)}
                />
                <button
                  disabled={planning || !answers.trim()}
                  onClick={() => makePlan(`${plan.request}\n\nAnswers to your questions:\n${answers}`)}
                  className="mt-2 rounded-lg border border-line px-4 py-1.5 text-sm hover:bg-panel disabled:opacity-50"
                >
                  {planning ? "Re-planning…" : "Answer and re-plan"}
                </button>
              </div>
            )}
          </div>

          {actions.map((a) => {
            const draft = drafts[a.id];
            const problems = finished ? [] : problemsFor(a);
            const decision = draft?.decision ?? null;
            return (
              <div
                key={a.id}
                className={`rounded-2xl border bg-panel p-5 transition ${
                  decision === "approve" ? "border-blue/60" : decision === "reject" ? "border-line opacity-60" : "border-line"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden>{ICONS[a.type]}</span>
                  <span className="font-medium">{ACTION_LABELS[a.type]}</span>
                  {finished && <StatusBadge status={a.status} />}
                  <span className="text-sm text-muted">· {a.reason}</span>
                </div>

                <div className="mt-4">
                  <ActionEditor
                    type={a.type}
                    payload={draft?.payload ?? a.payload}
                    onChange={(p) => update(a.id, { payload: p })}
                    disabled={finished || running}
                  />
                </div>

                {problems.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-warn">
                    {problems.map((p, i) => (
                      <li key={i}>⚠ {p}</li>
                    ))}
                  </ul>
                )}

                {finished ? (
                  <ActionResult action={a} />
                ) : (
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => update(a.id, { decision: decision === "approve" ? null : "approve" })}
                      disabled={running}
                      className={`rounded-lg px-4 py-1.5 text-sm ${
                        decision === "approve" ? "bg-blue text-white" : "border border-line hover:bg-panel-2"
                      }`}
                    >
                      {decision === "approve" ? "✓ Approved" : "Approve"}
                    </button>
                    <button
                      onClick={() => update(a.id, { decision: decision === "reject" ? null : "reject" })}
                      disabled={running}
                      className={`rounded-lg px-4 py-1.5 text-sm ${
                        decision === "reject" ? "bg-panel-2 text-muted" : "border border-line hover:bg-panel-2"
                      }`}
                    >
                      {decision === "reject" ? "Rejected" : "Reject"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel-2/95 p-4 backdrop-blur">
            {finished ? (
              <>
                <span className="text-sm">
                  <span className="text-ok">{succeeded} done</span>
                  {failed > 0 && <span className="text-bad"> · {failed} failed</span>}
                  <span className="text-muted"> · full history in Activity</span>
                </span>
                <button onClick={reset} className="brand-gradient rounded-lg px-5 py-2 text-sm font-medium text-white">
                  New request
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                  <span>
                    {approved.length} of {actions.length} approved
                  </span>
                  {actions.length > 0 && (
                    <button onClick={approveAllValid} className="text-cyan hover:underline">
                      Approve all ready
                    </button>
                  )}
                  <button onClick={reset} className="hover:text-text">
                    Discard plan
                  </button>
                </div>
                <button
                  onClick={run}
                  disabled={running || decided.length === 0 || blocked}
                  className="brand-gradient rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {running ? "Running…" : approved.length ? `Run ${approved.length} approved action${approved.length > 1 ? "s" : ""}` : "Confirm"}
                </button>
              </>
            )}
          </div>
          {!finished && decided.length < actions.length && decided.length > 0 && (
            <p className="text-center text-xs text-muted">Actions you don&apos;t approve or reject will be cancelled.</p>
          )}
        </section>
      )}
    </div>
  );
}
