import type { ActionRow } from "@/lib/actions";

// Shows what an executed action produced: a link, or a research summary.
export function ActionResult({ action }: { action: ActionRow }) {
  if (action.status === "failed") {
    return <p className="mt-3 rounded-lg bg-bad/10 p-3 text-sm text-bad">{action.error}</p>;
  }
  if (action.status !== "succeeded" || !action.result) return null;
  const r = action.result as { link?: string; summary?: string; sources?: { title: string; url: string }[] };

  if (action.type === "research") {
    return (
      <div className="mt-3 rounded-lg bg-panel-2 p-4 text-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{r.summary}</p>
        {!!r.sources?.length && (
          <div className="mt-4">
            <div className="text-xs font-medium text-muted">Sources</div>
            <ul className="mt-1 space-y-1">
              {r.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan hover:underline">
                    {s.title || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  return r.link ? (
    <a href={r.link} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-cyan hover:underline">
      Open in Google →
    </a>
  ) : null;
}
