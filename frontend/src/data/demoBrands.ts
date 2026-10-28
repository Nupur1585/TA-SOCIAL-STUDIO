/**
 * DEMONSTRATION DATA ONLY.
 * Demo media/content are written against two placeholder brand ids. This maps
 * them onto the user's real brands so the demo items resolve to real names.
 * With no brands there is nothing to attach demo items to, so none are shown.
 */
export function remapBrands<T extends { brandId: string }>(items: T[], brandIds: string[]): T[] {
  const first = brandIds[0];
  if (!first) return [];
  const second = brandIds[1] ?? first;
  return items.map((i) => ({ ...i, brandId: i.brandId === "brd-002" ? second : first }));
}
