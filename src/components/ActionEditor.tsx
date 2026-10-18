"use client";

import { useState } from "react";
import type { ActionType } from "@/lib/actions";

type Payload = Record<string, unknown>;

// ISO timestamp <-> <input type="datetime-local"> value in the browser's zone.
function toLocalInput(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string {
  return v ? new Date(v).toISOString() : "";
}

// Keeps the raw text locally so typing "a@b.com, " isn't swallowed mid-edit.
function RecipientsInput({ value, onChange }: { value: string[]; onChange: (to: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      className="field"
      placeholder="name@example.com"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-muted">{children}</label>;
}

export function ActionEditor({
  type,
  payload,
  onChange,
  disabled,
}: {
  type: ActionType;
  payload: Payload;
  onChange: (p: Payload) => void;
  disabled?: boolean;
}) {
  const set = (k: string, v: unknown) => onChange({ ...payload, [k]: v });
  const str = (k: string) => (typeof payload[k] === "string" ? (payload[k] as string) : "");

  switch (type) {
    case "create_calendar_event":
      return (
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <input className="field" value={str("title")} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Start</Label>
            <input type="datetime-local" className="field" value={toLocalInput(payload.start)} onChange={(e) => set("start", fromLocalInput(e.target.value))} />
          </div>
          <div>
            <Label>End</Label>
            <input type="datetime-local" className="field" value={toLocalInput(payload.end)} onChange={(e) => set("end", fromLocalInput(e.target.value))} />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <textarea rows={2} className="field" value={str("description")} onChange={(e) => set("description", e.target.value)} />
          </div>
        </fieldset>
      );
    case "create_task":
      return (
        <fieldset disabled={disabled} className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label>Task</Label>
            <input className="field" value={str("title")} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Due date</Label>
            <input type="date" className="field" value={str("due")} onChange={(e) => set("due", e.target.value || null)} />
          </div>
          <div className="sm:col-span-3">
            <Label>Notes</Label>
            <textarea rows={2} className="field" value={str("notes")} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </fieldset>
      );
    case "create_email_draft":
      return (
        <fieldset disabled={disabled} className="grid gap-3">
          <div>
            <Label>To (comma-separated)</Label>
            <RecipientsInput value={Array.isArray(payload.to) ? (payload.to as string[]) : []} onChange={(to) => set("to", to)} />
          </div>
          <div>
            <Label>Subject</Label>
            <input className="field" value={str("subject")} onChange={(e) => set("subject", e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <textarea rows={7} className="field" value={str("body")} onChange={(e) => set("body", e.target.value)} />
          </div>
          <p className="text-xs text-muted">Saved as a draft in Gmail. Relynt never sends email. You do.</p>
        </fieldset>
      );
    case "research":
      return (
        <fieldset disabled={disabled}>
          <Label>Question</Label>
          <textarea rows={2} className="field" value={str("question")} onChange={(e) => set("question", e.target.value)} />
        </fieldset>
      );
  }
}
