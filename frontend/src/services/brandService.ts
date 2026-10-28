import { formatDistanceToNow } from "date-fns";
import api from "./api";
import type { Brand, BrandStatus, PlatformKey } from "../types";

/** Shape returned by /api/admin/brands. */
interface ApiBrand {
  id: string;
  name: string;
  tagline: string;
  description: string;
  status: BrandStatus;
  hashtags: string[];
  timezone: string;
  platforms: PlatformKey[];
  assignedUsers: number;
  paletteIndex: number;
  assetCount: number;
  connectedAccounts: number;
  updatedAt: string;
}

export interface BrandInput {
  name: string;
  tagline: string;
  description: string;
  timezone: string;
  assignedUsers: number;
  hashtags: string[];
  platforms: PlatformKey[];
}

const palettes = [
  { banner: "from-sky-600 via-cyan-400 to-emerald-200", logo: "from-sky-600 to-blue-500" },
  { banner: "from-fuchsia-600 via-pink-400 to-orange-200", logo: "from-fuchsia-600 to-pink-500" },
  { banner: "from-emerald-700 via-emerald-400 to-lime-200", logo: "from-emerald-600 to-green-500" },
];

const makeInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Adds the presentation-only fields the Brands UI needs. */
function toBrand(b: ApiBrand): Brand {
  const palette = palettes[b.paletteIndex % palettes.length] ?? palettes[0]!;
  return {
    id: b.id,
    brandId: `BRD-${b.id.slice(-4).toUpperCase()}`,
    name: b.name,
    initials: makeInitials(b.name),
    tagline: b.tagline,
    description: b.description,
    timezone: b.timezone,
    assignedUsers: b.assignedUsers,
    hashtags: b.hashtags,
    platforms: b.platforms,
    status: b.status,
    assetCount: b.assetCount,
    connectedAccounts: b.connectedAccounts ?? 0,
    guidelinesUpdated: `${formatDistanceToNow(new Date(b.updatedAt))} ago`,
    bannerClass: palette.banner,
    logoClass: palette.logo,
  };
}

export async function listBrands(): Promise<Brand[]> {
  const { data } = await api.get("/admin/brands");
  return (data.data as ApiBrand[]).map(toBrand);
}

export const createBrand = async (input: BrandInput): Promise<Brand> =>
  toBrand((await api.post("/admin/brands", input)).data.data);

export const updateBrand = async (id: string, patch: Partial<BrandInput>): Promise<Brand> =>
  toBrand((await api.patch(`/admin/brands/${id}`, patch)).data.data);

export const setBrandStatus = async (id: string, status: BrandStatus): Promise<Brand> =>
  toBrand((await api.patch(`/admin/brands/${id}/status`, { status })).data.data);

export const deleteBrand = async (id: string): Promise<void> => {
  await api.delete(`/admin/brands/${id}`);
};
