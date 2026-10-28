import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as brandApi from "../services/brandService";
import { apiErrorMessage } from "../services/mediaService";
import type { Brand, BrandStatus } from "../types";
import { useAuth } from "./AuthContext";

export type NewBrandInput = brandApi.BrandInput;

interface BrandsContextValue {
  brands: Brand[];
  loading: boolean;
  /** Set when the brand list could not be loaded. */
  error: string | null;
  reload: () => void;
  selectedBrandId: string;
  setSelectedBrandId: (id: string) => void;
  /** These reject with an Error whose message is safe to show to the user. */
  addBrand: (input: NewBrandInput) => Promise<void>;
  updateBrand: (id: string, patch: Partial<NewBrandInput>) => Promise<void>;
  setBrandStatus: (id: string, status: BrandStatus) => Promise<void>;
  removeBrand: (id: string) => Promise<void>;
}

const BrandsContext = createContext<BrandsContextValue | null>(null);

/** Wraps an API call so callers always get a user-readable message. */
async function run<T>(work: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await work();
  } catch (e) {
    throw new Error(apiErrorMessage(e, fallback));
  }
}

// Brands live in MongoDB (/api/admin/brands); this context is only a cache of that list.
export function BrandsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") {
      setBrands([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    brandApi
      .listBrands()
      .then((list) => !cancelled && setBrands(list))
      .catch((e: unknown) => !cancelled && setError(apiErrorMessage(e, "Could not load brands. Is the backend running?")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, reloadKey]);

  // Always a real brand id (or "" when there are none), even after a brand is deleted.
  const selectedBrandId = brands.some((b) => b.id === picked) ? picked : (brands[0]?.id ?? "");

  const replace = useCallback((b: Brand) => setBrands((prev) => prev.map((x) => (x.id === b.id ? b : x))), []);

  const addBrand = useCallback(
    async (input: NewBrandInput) => {
      const created = await run(() => brandApi.createBrand(input), "Could not create the brand.");
      setBrands((prev) => [...prev, created]);
    },
    [],
  );

  const updateBrand = useCallback(
    async (id: string, patch: Partial<NewBrandInput>) => {
      replace(await run(() => brandApi.updateBrand(id, patch), "Could not update the brand."));
    },
    [replace],
  );

  const setBrandStatus = useCallback(
    async (id: string, next: BrandStatus) => {
      replace(await run(() => brandApi.setBrandStatus(id, next), "Could not change the brand status."));
    },
    [replace],
  );

  const removeBrand = useCallback(async (id: string) => {
    await run(() => brandApi.deleteBrand(id), "Could not delete the brand.");
    setBrands((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  const value = useMemo(
    () => ({
      brands,
      loading,
      error,
      reload,
      selectedBrandId,
      setSelectedBrandId: setPicked,
      addBrand,
      updateBrand,
      setBrandStatus,
      removeBrand,
    }),
    [brands, loading, error, reload, selectedBrandId, addBrand, updateBrand, setBrandStatus, removeBrand],
  );

  return <BrandsContext.Provider value={value}>{children}</BrandsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBrands() {
  const ctx = useContext(BrandsContext);
  if (!ctx) throw new Error("useBrands must be used inside BrandsProvider");
  return ctx;
}
