import type { ActionPayload, ActionType } from "@/lib/actions";
import { createCalendarEvent, createEmailDraft, createTask } from "@/lib/integrations/google";
import { runResearch } from "@/lib/research";

// The only code path that touches a user's accounts. Payloads arriving here
// have already been validated and approved.
export async function executeAction(userId: string, type: ActionType, payload: unknown): Promise<Record<string, unknown>> {
  switch (type) {
    case "create_calendar_event":
      return createCalendarEvent(userId, payload as ActionPayload["create_calendar_event"]);
    case "create_task":
      return createTask(userId, payload as ActionPayload["create_task"]);
    case "create_email_draft":
      return createEmailDraft(userId, payload as ActionPayload["create_email_draft"]);
    case "research":
      return runResearch((payload as ActionPayload["research"]).question);
  }
}
