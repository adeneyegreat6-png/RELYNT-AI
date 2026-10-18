import type { ActionStatus } from "@/lib/actions";

const styles: Record<ActionStatus, string> = {
  proposed: "border-line text-muted",
  rejected: "border-line text-muted line-through",
  executing: "border-warn/40 text-warn",
  succeeded: "border-ok/40 text-ok",
  failed: "border-bad/40 text-bad",
  cancelled: "border-line text-muted",
};

const labels: Record<ActionStatus, string> = {
  proposed: "Proposed",
  rejected: "Rejected",
  executing: "Running",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: ActionStatus }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs ${styles[status]}`}>{labels[status]}</span>;
}
