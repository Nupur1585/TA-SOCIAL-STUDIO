import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { sampleBrands } from "../data/sampleData";
import type { Brand } from "../types";

export type NewBrandInput = Omit<
  Brand,
  "id" | "brandId" | "initials" | "bannerClass" | "logoClass"
>;

interface BrandsContextValue {
  brands: Brand[];
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  addBrand: (input: NewBrandInput) => void;
  updateBrand: (id: string, patch: Partial<Brand>) => void;
  removeBrand: (id: string) => void;
}

const BrandsContext = createContext<BrandsContextValue | null>(null);

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

// State lives in memory only: there is no brand API in the backend yet.
export function BrandsProvider({ children }: { children: ReactNode }) {
  const [brands, setBrands] = useState<Brand[]>(sampleBrands);
  const [selectedBrandId, setSelectedBrandId] = useState(sampleBrands[0].id);

  const addBrand = useCallback((input: NewBrandInput) => {
    setBrands((prev) => {
      const palette = palettes[prev.length % palettes.length];
      const created: Brand = {
        ...input,
        id: `brd-${Date.now()}`,
        brandId: `BRD-${String(prev.length + 1).padStart(3, "0")}`,
        initials: makeInitials(input.name),
        bannerClass: palette.banner,
        logoClass: palette.logo,
      };
      return [...prev, created];
    });
  }, []);

  const updateBrand = useCallback((id: string, patch: Partial<Brand>) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const removeBrand = useCallback((id: string) => {
    setBrands((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const value = useMemo(
    () => ({ brands, selectedBrandId, setSelectedBrandId, addBrand, updateBrand, removeBrand }),
    [brands, selectedBrandId, addBrand, updateBrand, removeBrand],
  );

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBrands() {
  const ctx = useContext(BrandsContext);
  if (!ctx) throw new Error("useBrands must be used inside BrandsProvider");
  return ctx;
}
