"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Sign-in is unavailable right now.");
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8">
        <Link href="/">
          <Logo />
        </Link>
        {state === "sent" ? (
          <div className="mt-8">
            <h1 className="text-xl font-semibold">Check your email</h1>
            <p className="mt-2 text-sm text-muted">
              We sent a sign-in link to <span className="text-text">{email}</span>. Open it on this device.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <h1 className="text-xl font-semibold">Sign in or create an account</h1>
              <p className="mt-1 text-sm text-muted">No password. We&apos;ll email you a link.</p>
            </div>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
            <button
              disabled={state === "sending"}
              className="brand-gradient w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-60"
            >
              {state === "sending" ? "Sending…" : "Email me a link"}
            </button>
            {state === "error" && <p className="text-sm text-bad">{message}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
