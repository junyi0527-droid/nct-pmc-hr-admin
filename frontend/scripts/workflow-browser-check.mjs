// Run with the isolated backend (tests.browser_server), Vite on 5174 and
// Firefox --remote-debugging-port 9223. Uses Firefox's WebDriver BiDi API.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const socket = new WebSocket('ws://127.0.0.1:9223/session')
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
const pending = new Map()
let sequence = 0
const errors = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id)
    clearTimeout(timer); pending.delete(message.id)
    message.type === 'error' ? reject(new Error(`${message.error}: ${message.message}`)) : resolve(message.result)
  } else if (message.method === 'log.entryAdded' && message.params.level === 'error' && message.params.type === 'javascript') errors.push(message.params.text)
})
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)) }, 15000)
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }))
  })
}
await command('session.new', { capabilities: { alwaysMatch: { acceptInsecureCerts: true } } })
const { context } = await command('browsingContext.create', { type: 'tab' })
await command('session.subscribe', { events: ['log.entryAdded'], contexts: [context] })
async function evaluate(expression) {
  const result = await command('script.evaluate', { expression: `(async()=>JSON.stringify(await (async()=>{${expression}})()))()`, target: { context }, awaitPromise: true })
  if (result.type === 'exception') throw new Error(JSON.stringify(result.exceptionDetails))
  return JSON.parse(result.result.value ?? 'null')
}
async function until(expression, message) {
  const end = Date.now() + 12000
  do {
    if (await evaluate(`return !!(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 80))
  } while (Date.now() < end)
  throw new Error(`${message}: ${await evaluate('return document.body.innerText.slice(-1800)')}`)
}
async function navigate(path, heading) {
  await command('browsingContext.navigate', { context, url: `http://127.0.0.1:5174${path}`, wait: 'complete' })
  await until(`[...document.querySelectorAll('h1,h2')].some(h=>h.getClientRects().length && h.textContent.includes(${JSON.stringify(heading)}))`, `Heading missing on ${path}`)
}
async function click(text, dialog = false) {
  await evaluate(`const root=${dialog ? "document.querySelector('dialog[open]')" : 'document'}; const button=[...root.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!button) throw Error('Button missing: '+${JSON.stringify(text)}); button.click(); return true`)
}
async function fill(label, value, dialog = true) {
  await evaluate(`const root=${dialog ? "document.querySelector('dialog[open]')" : 'document'}; const label=[...root.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)})); if(!label) throw Error('Label missing: '+${JSON.stringify(label)}); const el=root.querySelector('#'+CSS.escape(label.htmlFor)); const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); return true`)
}
async function modalAction(label, notes = 'Checked in isolated browser QA') {
  await click(label)
  await until("document.querySelector('dialog[open] form textarea')", 'Action dialog missing')
  await evaluate(`const el=document.querySelector('dialog[open] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,${JSON.stringify(notes)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true`)
  await click(label, true)
  await until("!document.querySelector('dialog[open]')", `Action did not save: ${label}`)
}
try {
  await navigate('/login', 'Welcome')
  await evaluate("localStorage.removeItem('nct_hr_token'); location.href='/login'; return true")
  await until("document.querySelector('input[type=email]') && document.querySelector('input[type=password]')", 'Login form did not reset')
  await evaluate(`for (const [selector,value] of [['input[type=email]','system_administrator@qa.example.com'],['input[type=password]','WorkflowQAonly#2026']]) {const el=document.querySelector(selector); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true}));} document.querySelector('form').requestSubmit(); return true`)
  await until("location.pathname==='/dashboard' && document.querySelector('h1')?.textContent.includes('Welcome,')", 'Login failed')
  await navigate('/documents', 'Documents & E-Forms')
  await click('New record')
  await until("document.querySelector('dialog[open]')", 'Create form did not open')
  await fill('Title', 'Browser QA filing')
  await fill('Company', 'Browser QA Sdn Bhd')
  await fill('Document category', 'Invoice')
  await click('Save draft', true)
  await until("location.pathname.startsWith('/records/') && document.querySelector('h1')?.textContent==='Browser QA filing'", 'Draft did not save')
  const recordPath = await evaluate('return location.pathname')
  await click('Documents (0)')
  await fill('Document category', 'Invoice', false)
  const node = await command('script.evaluate', { expression: "document.querySelector('input[type=file]')", target: { context }, awaitPromise: false, resultOwnership: 'root' })
  await command('input.setFiles', { context, element: { sharedId: node.result.sharedId }, files: [fileURLToPath(new URL('./fixtures/workflow-document.txt', import.meta.url))] })
  await click('Upload document')
  await until("document.body.innerText.includes('Invoice · v1')", 'Document upload did not save')
  await click('Verify')
  await fill('Checks performed', 'Company, amount, date and completeness checked')
  await click('Save verification', true)
  await until("!document.querySelector('dialog[open]') && document.body.innerText.includes('Verified')", 'Verification did not save')
  await modalAction('Submit request')
  for (let index = 0; index < 7; index++) await modalAction('Complete current step')
  await until("document.body.innerText.includes('All workflow steps completed')", 'Filing workflow did not finish')
  await navigate(recordPath, 'Browser QA filing')
  assert(await evaluate("return document.body.innerText.includes('Completed')"), 'Record did not survive reload')
  console.log('PASS: login, create draft, upload, document verification, full filing workflow and reload')

  await navigate('/approvals', 'Approvals')
  await click('Rules')
  await until("document.body.innerText.includes('Configure approval rule')", 'Rule editor missing')
  await evaluate("const el=document.querySelector('select[aria-label=\"Add approver to Default approval order\"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'2'); el.dispatchEvent(new Event('change',{bubbles:true})); return true")
  await click('Add amount threshold')
  await fill('Threshold 1: at or above', '100.00', false)
  await evaluate("const el=document.querySelector('select[aria-label=\"Add approver to Threshold 1 approval order\"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'4'); el.dispatchEvent(new Event('change',{bubbles:true})); return true")
  await fill('SOP / HR and Finance', 'Isolated QA confirmation; not a company SOP', false)
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Confirmed by the responsible')).click(); return true")
  await click('Save rule')
  await until("document.body.innerText.includes('Rule saved.')", 'Threshold rule did not save')
  await navigate('/approvals', 'Approvals')
  await click('Rules')
  await until("[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Purchase Requisition (PR) · *'))", 'Saved company rule missing after reload')
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Purchase Requisition (PR) · *')).click(); return true")
  await until("[...document.querySelectorAll('label')].some(l=>l.textContent.startsWith('Threshold 1:') && document.getElementById(l.htmlFor)?.value==='100.00')", 'Saved threshold missing after reload')
  console.log('PASS: configure ordered approvers and amount threshold; save and reload')

  const routes = [['/dashboard', 'Welcome,'], ['/workflows', 'HR administration workflows'], ['/purchase-requisitions', 'Purchasing & Suppliers'], ['/business-licence', 'Licences, MOF & CIDB'], ['/vehicle-insurance', 'Insurance & Road Tax'], ['/utility-bills', 'Utility Bills'], ['/uniforms', 'Uniforms, stationery & equipment'], ['/petty-cash', 'Petty Cash & Claims'], ['/maintenance', 'Office & Facility Services'], ['/memo', 'Memos'], ['/documents', 'Documents & E-Forms'], ['/approvals', 'Approvals'], ['/finance', 'Finance queue'], ['/payments', 'Payments & Finance'], ['/reports', 'Reports & request register'], ['/users', 'User management'], ['/vehicle-borrowing', 'Vehicle Borrowing']]
  let layouts = 0
  for (const width of [1280, 390, 320]) {
    await command('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 })
    for (const [path, heading] of routes) {
      await navigate(path, heading)
      assert(await evaluate('return document.documentElement.scrollWidth <= innerWidth + 1'), `Horizontal overflow at ${path} / ${width}`)
      assert(!await evaluate("return /Unexpected Application Error|useWorkspace.*null|TypeError:|ReferenceError:/.test(document.body.innerText)"), `Render error at ${path}`)
      layouts++
    }
  }
  console.log(`PASS: ${layouts} page/viewport checks, no page overflow or render errors`)
  await navigate(recordPath, 'Browser QA filing')
  const screenshot = await command('browsingContext.captureScreenshot', { context, origin: 'viewport' })
  await writeFile('/tmp/hr-admin-workflow-mobile.png', Buffer.from(screenshot.data, 'base64'))
  await command('browsingContext.setViewport', { context, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 })
  await navigate('/workflows', 'HR administration workflows')
  const desktop = await command('browsingContext.captureScreenshot', { context, origin: 'viewport' })
  await writeFile('/tmp/hr-admin-workflows-desktop.png', Buffer.from(desktop.data, 'base64'))
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log('PASS: no JavaScript exceptions; screenshots saved in /tmp')
} finally {
  await command('session.end').catch(() => {})
  socket.close()
}
