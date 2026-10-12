/** Simple "TA" mark used in the sidebar, top bar and brand selector. */
export function BrandLogo({
  initials = "TA",
  gradient = "from-indigo-700 to-violet-600",
  className = "h-9 w-9 text-sm",
}: {
  initials?: string;
  gradient?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-extrabold tracking-tight text-white ${gradient} ${className}`}
    >
      {initials}
    </span>
  );
}
