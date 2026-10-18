import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getUser } from "@/lib/auth";

// Every page here is per-user, so render at request time.
export const instant = false;

const nav = [
  { href: "/app", label: "Command" },
  { href: "/app/activity", label: "Activity" },
  { href: "/app/settings", label: "Settings" },
];

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const user = await getUser();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line bg-panel/60">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/app">
            <Logo size={26} />
          </Link>
          <nav className="flex gap-1 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-panel-2 hover:text-text">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span className="hidden sm:inline">{user?.email}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md border border-line px-3 py-1.5 hover:bg-panel-2">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
