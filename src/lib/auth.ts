import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

// Verifies the session with Supabase Auth (not just by decoding the cookie).
export async function getUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Please sign in.");
  return user;
}

export function errorResponse(err: unknown): Response {
  if (err instanceof HttpError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
