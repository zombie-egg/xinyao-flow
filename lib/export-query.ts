export function exportHref(
  entity: "customers" | "orders",
  params: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page" && key !== "panel" && key !== "return")
      query.set(key, value);
  }
  const suffix = query.toString();
  return `/api/${entity}/export${suffix ? `?${suffix}` : ""}`;
}
