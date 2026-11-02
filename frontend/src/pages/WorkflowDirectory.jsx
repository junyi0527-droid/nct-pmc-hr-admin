import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, Car, CheckCircle2, CircleDot, FileText, GitBranch, Layers, ListChecks, ReceiptText, Search, ShieldCheck, Shirt, ShoppingCart, Wallet, Wrench, Workflow } from 'lucide-react'
import { useWorkflow } from '../contexts/WorkflowContext'
import { WorkflowError } from './WorkflowPage'
import './workflow-directory.css'

export const GROUP_ROUTES = { purchasing: '/purchase-requisitions', inventory: '/uniforms', documents: '/documents', finance: '/payments', utilities: '/utility-bills', insurance: '/vehicle-insurance', licences: '/business-licence', memos: '/memo', maintenance: '/maintenance', claims: '/petty-cash' }
const GROUP_ICONS = { purchasing: ShoppingCart, inventory: Shirt, documents: FileText, finance: Wallet, utilities: ReceiptText, insurance: ShieldCheck, licences: Building2, memos: FileText, maintenance: Wrench, claims: Wallet }
const GROUP_COPY = {
  purchasing:'The full procurement cycle — from stationery runs to supplier management.',
  inventory:'Manage uniforms, equipment and stock through a documented workflow.',
  documents:'Keep documents, evidence and decisions organised in one place.',
  finance:'Track payment requests, confirmations and supporting records.',
  utilities:'Stay on top of bills, payment evidence and service accounts.',
  insurance:'Manage vehicle insurance, policy renewals and road tax.',
  licences:'Track registrations, licence renewals and compliance requirements.',
  memos:'Prepare, review and approve internal communications.',
  maintenance:'Coordinate repairs, inspections and maintenance requests.',
  claims:'Manage claims, petty cash and supporting receipts.',
}

export default function WorkflowDirectory() {
  const { catalog, records, rules, error, loading, refresh } = useWorkflow()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [readyOnly, setReadyOnly] = useState(false)
  const processes = Object.entries(catalog.processes)
  const isReady = (kind, process) => !process.steps.some((step)=>step.kind === 'approval') || rules.some((rule)=>rule.kind === kind && rule.confirmed)
  const readyCount = processes.filter(([kind,process])=>isReady(kind,process)).length
  const stepCount = processes.reduce((sum,[,process])=>sum + process.steps.length,0)
  const matches = (kind,process) => (category === 'all' || process.group === category) && (!readyOnly || isReady(kind,process)) && `${process.title} ${catalog.groups[process.group] || ''} ${process.number || ''}`.toLowerCase().includes(query.trim().toLowerCase())
  const groups = Object.entries(catalog.groups).map(([group,title])=>({group,title,processes:processes.filter(([kind,process])=>process.group === group && matches(kind,process))})).filter((group)=>group.processes.length)
  const shown = groups.reduce((sum,group)=>sum + group.processes.length,0)
  const stats = [
    {label:'Workflows',value:processes.length,caption:'Across administration workflows',icon:Layers},
    {label:'Documented steps',value:stepCount,caption:'Process steps mapped end to end',icon:ListChecks},
    {label:'Ready to start',value:readyCount,caption:'No approval setup outstanding',icon:CircleDot},
    {label:'Records logged',value:records.length,caption:'Your saved requests in one place',icon:ReceiptText},
  ]
  return <div className="workflow-directory directory-redesign">
    <header className="directory-hero"><div className="directory-hero-copy"><span className="directory-eyebrow"><Workflow size={13}/> Workflow directory</span><h1>Every process, <em>one directory</em></h1><p>Browse your administration workflows, see the documented steps, and jump straight into the ones that are ready.</p><div className="directory-hero-chips"><span><Layers size={13}/>{processes.length} workflows</span><span><ListChecks size={13}/>{stepCount} documented steps</span><span><CircleDot size={13}/>{readyCount} ready to start</span></div></div><div className="directory-hero-art" aria-hidden="true"><div className="directory-mosaic">{Array.from({length:16},(_,index)=><i key={index} className={[0,3,4,5,7,8,10,11,12,15].includes(index)?'gold':''}/>)}</div><span className="directory-art-card art-ready"><CircleDot size={17}/><span><strong>{readyCount}</strong><small>Ready to start</small></span></span><span className="directory-art-card art-steps"><ListChecks size={17}/><span><strong>{stepCount} steps mapped</strong><small>across workflows</small></span></span></div></header>
    <WorkflowError error={error} retry={refresh}/>
    <div className="directory-stats">{stats.map(({label,value,caption,icon:Icon})=><section className="directory-stat" key={label}><div><span><Icon size={17}/></span><h2>{label}</h2></div><strong>{loading?'—':value}</strong><p>{caption}</p></section>)}</div>
    <section className="directory-filters" aria-label="Workflow filters"><div className="directory-filter-top"><label className="directory-search"><Search size={16}/><input aria-label="Search workflows" placeholder={'Search workflows — try “purchase order”…'} value={query} onChange={(event)=>setQuery(event.target.value)}/>{query && <button type="button" aria-label="Clear search" onClick={()=>setQuery('')}>×</button>}</label><div className="directory-filter-chips"><button type="button" aria-pressed={category==='all'} onClick={()=>setCategory('all')}><Layers size={13}/>All workflows</button>{['purchasing','inventory'].filter((group)=>catalog.groups[group]).map((group)=>{const Icon=GROUP_ICONS[group];return <button key={group} type="button" aria-pressed={category===group} onClick={()=>setCategory(group)}><Icon size={13}/>{catalog.groups[group]}</button>})}{Object.keys(catalog.groups).some((group)=>!['purchasing','inventory'].includes(group)) && <select aria-label="Other workflow categories" value={['purchasing','inventory'].includes(category)?'all':category} onChange={(event)=>setCategory(event.target.value)}><option value="all">More categories</option>{Object.entries(catalog.groups).filter(([group])=>!['purchasing','inventory'].includes(group)).map(([group,title])=><option value={group} key={group}>{title}</option>)}</select>}<button type="button" aria-pressed={readyOnly} onClick={()=>setReadyOnly(!readyOnly)}><CircleDot size={13}/>Ready to start</button></div></div><p role="status">{loading?'Loading workflows…':`Showing ${shown} of ${processes.length} workflows`}</p></section>
    {groups.map(({group,title,processes:items})=>{const Icon=GROUP_ICONS[group]||Layers;return <section className="directory-group" key={group}><header><span className="directory-group-icon"><Icon size={20}/></span><div><h2>{title}</h2><p>{GROUP_COPY[group]||'Browse the documented processes in this category.'}</p></div><small>{items.length} workflows · {items.reduce((sum,[,process])=>sum+process.steps.length,0)} steps</small></header><div className="directory-card-grid">{items.map(([kind,process])=>{const ready=isReady(kind,process);const count=records.filter((record)=>record.kind===kind).length;return <Link className={`directory-process-card ${ready?'is-ready':''}`} key={kind} to={`${GROUP_ROUTES[group]||'/workflows'}?type=${kind}`}><span className="directory-process-icon"><Icon size={20}/></span><ArrowUpRight className="directory-open-icon" size={16}/><div className="directory-process-tags"><span>{process.number?`Process ${process.number}`:'Register'}</span><span className={ready?'ready':'setup'}>{ready?'Ready to start':'Awaiting setup'}</span></div><h3>{process.title}</h3><p className="directory-process-copy">{process.description || `Start and track ${process.title.toLowerCase()} requests, documents and decisions.`}</p><div className="directory-step-dots" aria-hidden="true">{process.steps.slice(0,16).map((step,index)=><i key={index} className={step.kind==='approval'?'approval':''}/>)}{process.steps.length>16&&<small>+{process.steps.length-16}</small>}</div><div className="directory-process-meta"><span><ListChecks size={12}/>{process.steps.length} steps</span><span>·</span><span><FileText size={12}/>{count} records</span></div><div className="directory-process-status">{ready?<CheckCircle2 size={13}/>:<GitBranch size={13}/>}<span>{ready?'Workflow ready to start':'Approval responsibilities to confirm'}</span></div></Link>})}</div></section>})}
    {!loading&&!groups.length&&<div className="directory-no-results"><Search size={25}/><h2>No matching workflows</h2><p>Try a different search or clear your filters.</p><button type="button" onClick={()=>{setQuery('');setCategory('all');setReadyOnly(false)}}>Clear filters</button></div>}
    {!query&&category==='all'&&!readyOnly&&<section className="directory-shared"><Link to="/approvals"><GitBranch size={20}/><div><strong>Shared approval inbox</strong><p>Review assigned requests and track decisions.</p></div><ArrowUpRight size={16}/></Link><Link to="/vehicle-borrowing"><Car size={20}/><div><strong>Company vehicle booking</strong><p>Check availability and manage collection and return.</p></div><ArrowUpRight size={16}/></Link></section>}
  </div>
}

