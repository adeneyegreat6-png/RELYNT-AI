import { requireUser } from "@/lib/auth";
import { getGoogleConnection, GOOGLE_SCOPES } from "@/lib/integrations/google";
import { getUsage } from "@/lib/usage";
import { DeleteAccount, DisconnectGoogle } from "@/components/SettingsActions";

const SCOPE_LABELS: Record<string, string> = {
  "https://www.googleapis.com/auth/calendar.events": "Calendar: read and create events",
  "https://www.googleapis.com/auth/tasks": "Tasks: create tasks",
  "https://www.googleapis.com/auth/gmail.compose": "Gmail: create drafts (never sends)",
};

export default async function SettingsPage({ searchParams }: PageProps<"/app/settings">) {
  const user = await requireUser();
  const { google } = await searchParams;
  const [conn, usage] = await Promise.all([getGoogleConnection(user.id), getUsage(user.id)]);
  const wanted = GOOGLE_SCOPES.filter((s) => SCOPE_LABELS[s]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      {google === "connected" && <div className="rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm text-ok">Google connected.</div>}
      {google === "error" && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-4 text-sm text-bad">Couldn&apos;t connect Google. Please try again.</div>
      )}

      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Google</h2>
            <p className="text-sm text-muted">
              {conn ? `Connected as ${conn.accountEmail ?? "your Google account"}` : "Not connected"}
            </p>
          </div>
          {conn ? (
            <DisconnectGoogle />
          ) : (
            <a href="/api/integrations/google/start" className="brand-gradient rounded-lg px-4 py-2 text-sm font-medium text-white">
              Connect Google
            </a>
          )}
        </div>
        <ul className="mt-4 space-y-1 text-sm">
          {wanted.map((s) => (
            <li key={s} className={conn?.scopes.includes(s) ? "text-text" : "text-muted"}>
              {conn?.scopes.includes(s) ? "✓" : "○"} {SCOPE_LABELS[s]}
            </li>
          ))}
        </ul>
        {conn && wanted.some((s) => !conn.scopes.includes(s)) && (
          <a href="/api/integrations/google/start" className="mt-3 inline-block text-sm text-cyan hover:underline">
            Grant missing access →
          </a>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Plan &amp; usage</h2>
        <p className="mt-1 text-sm text-muted">Free plan · resets on the 1st of each month</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Plans", used: usage.plans, limit: usage.limits.plansPerMonth },
            { label: "Actions run", used: usage.actions, limit: usage.limits.actionsPerMonth },
          ].map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-sm">
                <span>{m.label}</span>
                <span className="text-muted">
                  {m.used} / {m.limit}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-panel-2">
                <div className="brand-gradient h-2 rounded-full" style={{ width: `${Math.min(100, (m.used / m.limit) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Deleting your account disconnects Google, revokes Relynt&apos;s access token, and erases your plans and activity history.
        </p>
        <DeleteAccount />
      </section>
    </div>
  );
}
