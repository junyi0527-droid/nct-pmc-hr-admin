export default function Table({ className = '', children, ...props }) {
  return (
    <div
      className={`ui-scroll rounded-lg border border-line bg-surface ${className}`}
      tabIndex={0}
      role="region"
      aria-label={props['aria-label'] || 'Scrollable data table'}
    >
      <table className="w-full text-left text-sm" {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className = '', children }) {
  return <thead className={`${className}`}>{children}</thead>
}

export function TableRow({ className = '', children }) {
  return <tr className={`border-b border-line last:border-b-0 ${className}`}>{children}</tr>
}

export function TableHead({ className = '', children }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50 ${className}`}
    >
      {children}
    </th>
  )
}

export function TableBody({ className = '', children }) {
  return <tbody className={`${className}`}>{children}</tbody>
}

export function TableCell({ className = '', children }) {
  return <td className={`px-4 py-3 text-slate-600 ${className}`}>{children}</td>
}
