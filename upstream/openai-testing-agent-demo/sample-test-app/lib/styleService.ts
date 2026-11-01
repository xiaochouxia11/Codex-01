export async function fetchAllStyles() {
  const res = await fetch("/api/store/styles");
  if (!res.ok) {
    throw new Error("Styles not found");
  }
  // The API returns a raw array of styles
  const data: unknown[] = await res.json();
  return data;
}

export async function fetchStyleById(id: number) {
  const res = await fetch(`/api/store/styles/${id}`);
  if (!res.ok) {
    throw new Error("Style not found");
  }
  const data: { style: unknown } = await res.json();
  return data.style;
}
