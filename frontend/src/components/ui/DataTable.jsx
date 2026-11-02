import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Button from './Button'
import Skeleton from './Skeleton'

/** columns: { key, label, render?(row), sortValue?(row) }. Bulk selection stays
 * local to this table; consumers choose the explicitly permitted bulk action. */
export default function DataTable({
  columns,
  rows,
  caption,
  loading = false,
  pageSize = 8,
  emptyMessage = 'No records found.',
  selectable = false,
  onBulkAction,
  bulkLabel = 'Archive selected',
  onOpen,
}) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: '', direction: 1 })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const filtered = useMemo(() => {
    const matching = rows.filter((row) =>
      columns.some(({ key }) =>
        String(row[key] ?? '')
          .toLowerCase()
          .includes(query.toLowerCase())
      )
    )
    if (!sort.key) return matching
    const column = columns.find((item) => item.key === sort.key)
    return [...matching].sort((a, b) => {
      const av = column.sortValue ? column.sortValue(a) : a[sort.key]
      const bv = column.sortValue ? column.sortValue(b) : b[sort.key]
      return (
        String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) *
        sort.direction
      )
    })
  }, [rows, columns, query, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pages)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const selectedIds = selected.filter((id) => rows.some((row) => row.id === id))
  const toggle = (id) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]))
  useEffect(() => setPage(1), [query])

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
        <label htmlFor={inputId} className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search {caption}</span>
          <Search
            className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted"
            aria-hidden="true"
          />
          <input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search records…"
            className="ui-field pl-9"
          />
        </label>
        {selectable && selectedIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onBulkAction?.(selectedIds)
              setSelected([])
            }}
          >
            {bulkLabel} ({selectedIds.length})
          </Button>
        )}
        <span className="text-xs text-muted" aria-live="polite">
          {filtered.length} records
        </span>
      </div>
      <div
        className="ui-scroll"
        role="region"
        aria-label={`${caption} table`}
        tabIndex={0}
        aria-busy={loading}
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-subtle text-xs text-muted">
            <tr>
              {selectable && (
                <th className="w-10 p-4">
                  <input
                    type="checkbox"
                    aria-label="Select all records on this page"
                    checked={
                      visible.length > 0 && visible.every((row) => selectedIds.includes(row.id))
                    }
                    onChange={(e) =>
                      setSelected((ids) =>
                        e.target.checked
                          ? [...new Set([...ids, ...visible.map((row) => row.id)])]
                          : ids.filter((id) => !visible.some((row) => row.id === id))
                      )
                    }
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3"
                  aria-sort={
                    sort.key === column.key
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    className="inline-flex items-center gap-2 rounded font-semibold"
                    onClick={() =>
                      setSort({
                        key: column.key,
                        direction: sort.key === column.key ? -sort.direction : 1,
                      })
                    }
                  >
                    {column.label}
                    {sort.key !== column.key ? (
                      <ArrowUpDown className="h-3 w-3" />
                    ) : sort.direction === 1 ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                  </button>
                </th>
              ))}
              {onOpen && (
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Details</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td
                    colSpan={columns.length + Number(selectable) + Number(!!onOpen)}
                    className="p-4"
                  >
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td
                  className="p-10 text-center text-muted"
                  colSpan={columns.length + Number(selectable) + Number(!!onOpen)}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.id} className="border-t border-line hover:bg-subtle">
                  {selectable && (
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.title || row.name || row.id}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4 align-top">
                      <div className="min-w-28 max-w-sm break-normal leading-relaxed">
                        {column.render ? column.render(row) : row[column.key]}
                      </div>
                    </td>
                  ))}
                  {onOpen && (
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Open ${row.title || row.name || row.id}`}
                        onClick={() => onOpen(row)}
                      >
                        Open
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line p-4 text-xs text-muted">
        <span>
          Page {currentPage} of {pages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            aria-label="Previous page"
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === pages}
            aria-label="Next page"
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
