export function bookingConflicts(
  bookings,
  { vehicle_id, borrow_date, borrow_time, return_date, return_time, id }
) {
  if (!vehicle_id || !borrow_date || !borrow_time || !return_date || !return_time) return []
  const start = `${borrow_date}T${borrow_time}`
  const end = `${return_date}T${return_time}`
  return bookings.filter(
    (row) =>
      String(row.vehicle_id) === String(vehicle_id) &&
      String(row.id) !== String(id) &&
      ['approved', 'completed'].includes(row.status) &&
      `${row.borrow_date}T${row.borrow_time || '09:00'}` < end &&
      `${row.return_date}T${row.return_time || '17:00'}` > start
  )
}

export function bookingPanel(row) {
  return {
    id: row.request_number,
    module: 'borrowing',
    title: `${row.request_number} · ${row.vehicle?.plate_number || 'Vehicle'}`,
    date: row.return_date,
    status:
      {
        pending: 'Pending approval',
        approved: row.collection_recorded_at ? 'Collected' : 'Approved',
        completed: 'Returned',
        rejected: 'Rejected',
        cancelled: 'Cancelled',
      }[row.status] || row.status,
    steps:
      row.status === 'rejected'
        ? ['Submitted', 'Rejected']
        : row.status === 'cancelled'
          ? ['Submitted', 'Cancelled']
          : ['Pending approval', 'Approved', 'Collected', 'Returned'],
    owner: row.requester_name,
    history: [
      {
        title: `Request submitted · ${row.borrow_date} ${row.borrow_time || 'Time not recorded'}`,
        actor: row.requester_name || 'Requestor',
        at: row.created_at,
      },
      ...(row.approved_at
        ? [{ title: 'Approval recorded', actor: 'Approver', at: row.approved_at }]
        : []),
      ...(row.collection_recorded_at
        ? [{ title: 'Collection recorded', actor: 'HR Admin', at: row.collection_recorded_at }]
        : []),
      ...(row.actual_return_date
        ? [{ title: 'Return recorded', actor: 'HR Admin', at: row.actual_return_date }]
        : []),
    ],
  }
}
