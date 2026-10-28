export default function Table({ className = '', children, ...props }) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      <table className="w-full text-sm text-left" {...props}>
        {children}
      </table>
    </div>
  )
}

export function TableHeader({ className = '', children }) {
  return <thead className={`${className}`}>{children}</thead>
}

export function TableRow({ className = '', children }) {
  return <tr className={`border-b border-slate-100 ${className}`}>{children}</tr>
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
