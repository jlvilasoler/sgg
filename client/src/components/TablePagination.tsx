export const PAGE_SIZE_OPTIONS = [20, 30, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface Props {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export default function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, total);

  return (
    <div className="table-pagination" role="navigation" aria-label="Paginación">
      <div className="table-pagination-size">
        <label htmlFor="page-size">Filas por página</label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <span className="table-pagination-info muted">
        {total === 0
          ? "Sin registros"
          : `${from}–${to} de ${total}`}
      </span>
      <div className="table-pagination-nav">
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange(1)}
          aria-label="Primera página"
        >
          «
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Página anterior"
        >
          ‹
        </button>
        <span className="table-pagination-page">
          Página {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Página siguiente"
        >
          ›
        </button>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Última página"
        >
          »
        </button>
      </div>
    </div>
  );
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
