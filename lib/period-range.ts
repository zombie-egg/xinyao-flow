const startOf = (value: string, mode: string) => {
  if (mode === "year") return new Date(`${value}-01-01T00:00:00+08:00`);
  if (mode === "month") return new Date(`${value}-01T00:00:00+08:00`);
  return new Date(`${value}T00:00:00+08:00`);
};

const endOf = (value: string, mode: string) => {
  if (mode === "year") return new Date(`${Number(value) + 1}-01-01T00:00:00+08:00`);
  if (mode === "month") {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month, 1) - 8 * 60 * 60 * 1000);
  }
  return new Date(startOf(value, mode).getTime() + 86400000);
};

export function periodRange(mode: string | undefined, from: string | undefined, to: string | undefined) {
  const selectedMode = mode === "year" || mode === "month" ? mode : "date";
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = startOf(from, selectedMode);
  if (to) range.lt = endOf(to, selectedMode);
  return Object.keys(range).length ? range : null;
}
