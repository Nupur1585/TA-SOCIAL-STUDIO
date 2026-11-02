import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isPlaceholder } from "../../lib/legalInfo";
import { BrandLogo } from "../ui/BrandLogo";

/** Renders an owner-supplied value; unconfirmed placeholders are highlighted so they cannot be missed. */
export function Fill({ value }: { value: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  return (
    <mark className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900">{value}</mark>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[#0a1a4a]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

export const listClass = "list-disc space-y-1.5 pl-5";

/** Shared shell for the public legal pages. Needs no login and loads no private data. */
export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Lexora`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const linkClass = "text-blue-700 hover:underline";

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f8fc] px-4">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between py-6">
        <Link to="/login" className="flex items-center gap-3">
          <BrandLogo className="h-10 w-10 text-base" gradient="from-blue-500 to-indigo-600" />
          <span className="text-sm font-bold tracking-widest text-[#0a1a4a]">LEXORA</span>
        </Link>
        <Link to="/login" className={`text-sm font-medium ${linkClass}`}>
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 pb-10">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h1 className="text-2xl font-bold text-[#0a1a4a] sm:text-3xl">{title}</h1>
          {intro && <p className="mt-3 text-sm leading-relaxed text-slate-600">{intro}</p>}
          {children}
        </article>
      </main>

      <footer className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6 text-xs text-slate-500">
        <Link to="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        <Link to="/data-deletion" className={linkClass}>
          Data Deletion
        </Link>
        <Link to="/terms" className={linkClass}>
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
