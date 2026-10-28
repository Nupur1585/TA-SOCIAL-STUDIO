import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { timezones } from "../../data/sampleData";
import type { NewBrandInput } from "../../context/BrandsContext";
import type { PlatformKey } from "../../types";

const platformOptions: { key: PlatformKey; label: string }[] = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Brand name is required"),
  tagline: z.string().trim(),
  description: z.string().trim().min(5, "Add a short description"),
  timezone: z.string().min(1),
  assignedUsers: z.string().regex(/^\d+$/, "Enter a number"),
  hashtags: z.string().trim(),
  platforms: z.array(z.string()),
});

type FormValues = z.infer<typeof schema>;

const field =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400";

export function AddBrandModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  /** Rejects with a user-readable message when the server refuses the brand. */
  onSubmit: (brand: NewBrandInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      tagline: "",
      description: "",
      timezone: timezones[0],
      assignedUsers: "1",
      hashtags: "",
      platforms: [],
    },
  });

  const [serverError, setServerError] = useState<string | null>(null);

  const submit = async (v: FormValues) => {
    setServerError(null);
    try {
      await onSubmit({
      name: v.name,
      tagline: v.tagline,
      description: v.description,
      timezone: v.timezone,
      assignedUsers: Number(v.assignedUsers),
      hashtags: v.hashtags
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((h) => (h.startsWith("#") ? h : `#${h}`)),
      platforms: v.platforms as PlatformKey[],
      });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Could not create the brand.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add brand"
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Add Brand</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Brand name
            <input className={field} {...register("name")} />
            {errors.name && (
              <span className="text-xs text-red-500">{errors.name.message}</span>
            )}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Tagline
            <input className={field} {...register("tagline")} />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Description
            <textarea rows={3} className={field} {...register("description")} />
            {errors.description && (
              <span className="text-xs text-red-500">
                {errors.description.message}
              </span>
            )}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Timezone
              <select className={field} {...register("timezone")}>
                {timezones.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Assigned users
              <input className={field} {...register("assignedUsers")} />
              {errors.assignedUsers && (
                <span className="text-xs text-red-500">
                  {errors.assignedUsers.message}
                </span>
              )}
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Default hashtags
            <input
              className={field}
              placeholder="#Brand #Tag"
              {...register("hashtags")}
            />
          </label>
          <fieldset>
            <legend className="text-sm font-medium text-slate-700">
              Social platforms
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {platformOptions.map((p) => (
                <label key={p.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    value={p.key}
                    {...register("platforms")}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {serverError && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {serverError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "Creating…" : "Create Brand"}
          </button>
        </div>
      </form>
    </div>
  );
}
