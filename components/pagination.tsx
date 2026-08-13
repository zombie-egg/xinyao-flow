import Link from "next/link";

export function Pagination({
  pathname,
  params,
  page,
  pageSize,
  total,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `${pathname}?${search.toString()}`;
  };
  return (
    <nav className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-zinc-500">
        共 {total} 条 · 第 {page}/{pages} 页
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-lg border bg-white px-4 py-2 hover:bg-zinc-50">
            上一页
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-lg border bg-white px-4 py-2 hover:bg-zinc-50">
            下一页
          </Link>
        )}
      </div>
    </nav>
  );
}
