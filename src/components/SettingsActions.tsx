"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DisconnectGoogle() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm("Disconnect Google? Relynt will lose access immediately.")) return;
        setBusy(true);
        await fetch("/api/integrations/google/disconnect", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
      className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel-2 disabled:opacity-50"
    >
      {busy ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

export function DeleteAccount() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm("Delete your account and all your data? This can't be undone.")) return;
          setBusy(true);
          const res = await fetch("/api/account/delete", { method: "POST" });
          if (res.ok) {
            router.push("/");
            router.refresh();
          } else {
            setError((await res.json()).error ?? "Couldn't delete the account.");
            setBusy(false);
          }
        }}
        className="rounded-lg border border-bad/50 px-4 py-2 text-sm text-bad hover:bg-bad/10 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete account and data"}
      </button>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
    </div>
  );
}
