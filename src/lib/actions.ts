import { z } from "zod";

// The contract between the AI and the real world. The model only ever
// PROPOSES actions; every proposal (and every user edit) is re-checked here
// before anything is executed. Keep this list short and each action narrow.

export const ACTION_TYPES = [
  "create_calendar_event",
  "create_task",
  "create_email_draft",
  "research",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

const MAX_DAYS_AHEAD = 365;

const isoDateTime = z.iso.datetime({ offset: true });

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    start: isoDateTime,
    end: isoDateTime,
    description: z.string().max(2000).default(""),
  })
  .superRefine((v, ctx) => {
    const start = Date.parse(v.start);
    const end = Date.parse(v.end);
    if (end <= start) ctx.addIssue({ code: "custom", message: "End must be after start.", path: ["end"] });
    if (end - start > 12 * 3600_000) ctx.addIssue({ code: "custom", message: "Events longer than 12 hours aren't allowed.", path: ["end"] });
    if (start < Date.now() - 5 * 60_000) ctx.addIssue({ code: "custom", message: "Start is in the past.", path: ["start"] });
    if (start > Date.now() + MAX_DAYS_AHEAD * 86400_000) ctx.addIssue({ code: "custom", message: "Start is too far in the future.", path: ["start"] });
  });

export const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(2000).default(""),
  due: z.iso.date().nullable().default(null),
});

export const emailDraftSchema = z.object({
  to: z.array(z.email()).min(1, "Add at least one recipient.").max(5, "At most 5 recipients."),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
});

export const researchSchema = z.object({
  question: z.string().trim().min(5).max(500),
});

export const payloadSchemas = {
  create_calendar_event: calendarEventSchema,
  create_task: taskSchema,
  create_email_draft: emailDraftSchema,
  research: researchSchema,
} satisfies Record<ActionType, z.ZodType>;

export type ActionPayload = {
  create_calendar_event: z.infer<typeof calendarEventSchema>;
  create_task: z.infer<typeof taskSchema>;
  create_email_draft: z.infer<typeof emailDraftSchema>;
  research: z.infer<typeof researchSchema>;
};

// Which Google scope each action needs. Research needs no connection.
export const REQUIRED_SCOPE: Record<ActionType, string | null> = {
  create_calendar_event: "https://www.googleapis.com/auth/calendar.events",
  create_task: "https://www.googleapis.com/auth/tasks",
  create_email_draft: "https://www.googleapis.com/auth/gmail.compose",
  research: null,
};

export const ACTION_LABELS: Record<ActionType, string> = {
  create_calendar_event: "Calendar event",
  create_task: "Task",
  create_email_draft: "Email draft",
  research: "Research",
};

export type ValidationResult =
  | { ok: true; payload: unknown }
  | { ok: false; errors: string[] };

export function validatePayload(type: string, payload: unknown): ValidationResult {
  if (!(ACTION_TYPES as readonly string[]).includes(type)) {
    return { ok: false, errors: [`Unknown action type: ${type}`] };
  }
  const result = payloadSchemas[type as ActionType].safeParse(payload);
  if (result.success) return { ok: true, payload: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
  };
}

export type ActionStatus = "proposed" | "rejected" | "executing" | "succeeded" | "failed" | "cancelled";

export type ActionRow = {
  id: string;
  plan_id: string;
  position: number;
  type: ActionType;
  payload: Record<string, unknown>;
  reason: string;
  status: ActionStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  executed_at: string | null;
  created_at: string;
};

export type PlanRow = {
  id: string;
  request: string;
  summary: string;
  questions: string[];
  status: "proposed" | "completed" | "cancelled";
  created_at: string;
};
