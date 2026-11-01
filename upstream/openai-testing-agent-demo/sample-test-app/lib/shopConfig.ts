export const categoryFilter: Record<
  string,
  { key: keyof import("@/stores/styleFiltersStore").StyleFilters; value: string } | null
> = {
  "just-in": null,
  clothes: { key: "masterCategory", value: "Apparel" },
  shoes: { key: "masterCategory", value: "Footwear" },
  accessories: { key: "masterCategory", value: "Accessories" },
  offers: null,
};