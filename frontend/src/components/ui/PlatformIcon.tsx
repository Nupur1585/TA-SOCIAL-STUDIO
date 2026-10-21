import type { PlatformKey } from "../../types";

const config: Record<PlatformKey, { bg: string; label: string }> = {
  instagram: {
    bg: "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600",
    label: "Instagram",
  },
  facebook: { bg: "bg-blue-600", label: "Facebook" },
  youtube: { bg: "bg-red-600", label: "YouTube" },
  linkedin: { bg: "bg-sky-700", label: "LinkedIn" },
  x: { bg: "bg-slate-900", label: "X" },
};

function Glyph({ platform }: { platform: PlatformKey }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-1/2 w-1/2",
    fill: "none",
    stroke: "white",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (platform) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="white" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} fill="white" stroke="none">
          <path d="M14 8.5V7c0-.8.2-1.2 1.3-1.2H17V3h-2.6C11.6 3 10.5 4.600 10.5 6.800V8.500H8V11.500h2.500V21h3.500v-9.500h2.600l.4-3z" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} fill="white" stroke="none">
          <path d="M9.500 8.200v7.600l6.500-3.800z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common} fill="white" stroke="none">
          <path d="M5 9h3v10H5zM6.500 4.500a1.700 1.700 0 110 3.400 1.700 1.700 0 010-3.400zM10 9h2.900v1.400c.5-.9 1.600-1.600 3.100-1.600 3 0 3.500 2 3.500 4.500V19h-3v-5c0-1.200 0-2.600-1.700-2.600S13 12.700 13 14v5h-3z" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      );
  }
}

export function PlatformIcon({
  platform,
  size = "md",
}: {
  platform: PlatformKey;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const dims = { xs: "h-5 w-5", sm: "h-6 w-6", md: "h-8 w-8", lg: "h-9 w-9" }[size];
  const { bg, label } = config[platform];
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${dims} ${bg}`}
    >
      <Glyph platform={platform} />
    </span>
  );
}

