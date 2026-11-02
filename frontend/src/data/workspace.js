import { addDays, todayKey } from '../lib/dates'

export const MODULES = {
  licences: {
    title: 'Business Licence',
    description: 'Track company licences, upcoming expiries and renewals.',
    route: '/business-licence',
    dateLabel: 'Expiry date',
    action: 'Add licence',
  },
  insurance: {
    title: 'Vehicle Insurance',
    description: 'Keep policies and road tax renewals in view.',
    route: '/vehicle-insurance',
    dateLabel: 'Policy expiry',
    action: 'Add policy',
  },
  bills: {
    title: 'Utility Bills',
    description: 'See what is due and follow each bill through its payment route.',
    route: '/utility-bills',
    dateLabel: 'Due date',
    action: 'Add bill',
  },
  memos: {
    title: 'Memo Approval',
    description: 'Prepare, review and track your administrative memos.',
    route: '/memo',
    dateLabel: 'Review by',
    action: 'New memo',
  },
}

const today = todayKey()
function record(id, module, title, offset, status, extra = {}) {
  return {
    id,
    module,
    title,
    date: addDays(today, offset),
    status,
    company: 'Meridian Demo Sdn Bhd',
    owner: 'Aina · Demo HR',
    archived: false,
    history: [{ title: 'Record created', actor: 'Demo HR Admin', at: addDays(today, -10) }],
    ...extra,
  }
}
export const INITIAL_RECORDS = [
  record('LIC-001', 'licences', 'Office operating licence', 5, 'In review'),
  record('LIC-002', 'licences', 'Signboard licence', -3, 'Recorded'),
  record('LIC-003', 'licences', 'Branch premises licence', 22, 'Recorded', {
    company: 'Cedar Demo Services',
  }),
  record('LIC-004', 'licences', 'Warehouse licence', 65, 'Complete'),
  record('LIC-005', 'licences', 'Satellite office licence', 120, 'Recorded'),
  record('POL-001', 'insurance', 'DEMO 2041 · Pool van policy', 8, 'In review', {
    roadTaxDate: addDays(today, 18),
    provider: 'Sample Assurance',
  }),
  record('POL-002', 'insurance', 'DEMO 3102 · Company car policy', 26, 'Recorded', {
    roadTaxDate: addDays(today, 40),
    provider: 'Example General Insurance',
  }),
  record('POL-003', 'insurance', 'DEMO 4420 · Delivery van policy', 75, 'Complete', {
    roadTaxDate: addDays(today, 90),
    provider: 'Sample Assurance',
  }),
  record('BILL-001', 'bills', 'Electricity · Demo head office', -4, 'Recorded', {
    amount: 1280.5,
    route: 'HR Admin handling',
  }),
  record('BILL-002', 'bills', 'Water · Demo warehouse', 2, 'In review', {
    amount: 245.8,
    route: 'HR Admin handling',
  }),
  record('BILL-003', 'bills', 'Internet · Demo branch', 6, 'Recorded', {
    amount: 389,
    route: 'Direct to Finance',
  }),
  record('BILL-004', 'bills', 'Telephone · Demo branch', 14, 'In review', {
    amount: 180,
    route: 'Direct to Finance',
  }),
  record('BILL-005', 'bills', 'Electricity · Demo warehouse', 20, 'Complete', {
    amount: 690,
    route: 'HR Admin handling',
  }),
  record('MEM-001', 'memos', 'Quarterly office maintenance notice', 0, 'Pending approval', {
    owner: 'Danish · Demo HR',
  }),
  record('MEM-002', 'memos', 'Pool vehicle usage reminder', 4, 'Draft'),
  record('MEM-003', 'memos', 'Office access update', 2, 'In review'),
  record('MEM-004', 'memos', 'Uniform collection notice', 9, 'Approved', {
    history: [
      { title: 'Draft created', actor: 'Demo HR Admin', at: addDays(today, -7) },
      { title: 'Approved in sample workflow', actor: 'Demo Approver', at: addDays(today, -1) },
    ],
  }),
]
export const MEMO_STAGES = ['Draft', 'In review', 'Pending approval', 'Approved']
export const PROCESS_STAGES = ['Recorded', 'In review', 'Approved', 'Complete']
export const canEditDemo = (role) => ['system_administrator', 'hr_admin'].includes(role)
export const canMoveMemo = (role) =>
  [...['system_administrator', 'hr_admin'], 'authorised_approver'].includes(role)
