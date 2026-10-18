import Link from "next/link";
import { Logo } from "@/components/Logo";

const steps = [
  { n: "01", title: "Request", body: "Say what you want in plain words. “Find time for three deep-work blocks next week and draft a reply to my client.”" },
  { n: "02", title: "Plan", body: "Relynt checks your calendar and lays out each step: the events, the tasks, the email draft." },
  { n: "03", title: "Approve", body: "You see exactly what will happen. Edit anything, reject anything. Nothing runs without your yes." },
  { n: "04", title: "Done", body: "Approved actions run in your Google account, and every result is logged with a link." },
];

export default function Home() {
  return (
    <main className="flex-1">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-panel">
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <p className="mb-5 inline-block rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted">
          Early access · Google Calendar, Tasks &amp; Gmail drafts
        </p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          From intention <span className="brand-text">to action.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          You decide the goal. Your AI handles the work. Relynt turns what you want done into a clear plan, waits for
          your approval, then carries it out.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/login" className="brand-gradient rounded-lg px-6 py-3 font-medium text-white shadow-lg shadow-blue/20">
            Get started free
          </Link>
          <a href="#how" className="rounded-lg border border-line px-6 py-3 font-medium hover:bg-panel">
            How it works
          </a>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-xl border border-line bg-panel p-5">
              <div className="font-mono text-xs text-cyan">{s.n}</div>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 rounded-xl border border-line bg-panel p-6 sm:grid-cols-2">
          <div>
            <h2 className="font-semibold">What it does today</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>✓ Plans your week around your existing Google Calendar</li>
              <li>✓ Creates calendar events and Google Tasks you approve</li>
              <li>✓ Writes email drafts into Gmail. You press send</li>
              <li>✓ Researches questions on the web, with sources</li>
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">What it will never do without you</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>✕ Send emails or messages</li>
              <li>✕ Delete anything in your accounts</li>
              <li>✕ Spend money or make purchases</li>
              <li>✕ Act on anything you haven&apos;t approved</li>
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        © Relynt AI · Think smarter. Act faster. Get things done.
      </footer>
    </main>
  );
}
