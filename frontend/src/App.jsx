import { useState, useEffect, useRef } from 'react'

// All API calls go to /api — Vite proxies to http://localhost:8000
async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// Status badge colours (Tailwind-free — uses index.css classes)
const SC = {
  'Pending':     'badge-yellow',
  'Processing':  'badge-blue',
  'In Progress': 'badge-blue',
  'Delivered':   'badge-green',
  'Completed':   'badge-green',
  'In Transit':  'badge-purple',
  'Planned':     'badge-gray',
  'Received':    'badge-green',
  'Paid':        'badge-green',
  'Active':      'badge-green',
  'On Leave':    'badge-yellow',
  'Pass':        'badge-green',
  'Fail':        'badge-red',
}
const Badge = ({ s }) => (
  <span className={`badge ${SC[s] || 'badge-gray'}`}>{s}</span>
)

// ── FormWrap defined OUTSIDE component so it never remounts on re-render
//    (prevents input losing focus)
function FormWrap({ title, onClose, onSave, saveLabel, children }) {
  return (
    <div className="form-panel">
      <div className="form-header">
        <span className="form-title">{title}</span>
        <button className="form-close" onClick={onClose}>✕</button>
      </div>
      {children}
      <div className="form-actions">
        <button className="btn btn-primary" onClick={onSave}>{saveLabel}</button>
        <button className="btn btn-ghost"   onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

const INR = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

// ── App ───────────────────────────────────────────────
export default function App() {
  const [tab,   setTab]   = useState('dashboard')
  const [toast, setToast] = useState('')

  // ── Data state ────────────────────────────────────
  const [dashboard,   setDashboard]   = useState({})
  const [inventory,   setInventory]   = useState([])
  const [production,  setProduction]  = useState([])
  const [procurement, setProcurement] = useState([])
  const [sales,       setSales]       = useState([])
  const [finance,     setFinance]     = useState({ entries: [], total_revenue: 0, total_expenses: 0, net_profit: 0 })
  const [hr,          setHr]          = useState({ employees: [], total: 0, total_payroll: 0 })
  const [quality,     setQuality]     = useState({ inspections: [], pass_rate: 0 })
  const [leads,       setLeads]       = useState([])

  // ── CRUD form visibility & edit id ────────────────
  const [showInvForm,  setShowInvForm]  = useState(false); const [editInvId,  setEditInvId]  = useState(null)
  const [showProdForm, setShowProdForm] = useState(false); const [editProdId, setEditProdId] = useState(null)
  const [showPOForm,   setShowPOForm]   = useState(false); const [editPOId,   setEditPOId]   = useState(null)
  const [showSOForm,   setShowSOForm]   = useState(false); const [editSOId,   setEditSOId]   = useState(null)
  const [showFinForm,  setShowFinForm]  = useState(false); const [editFinId,  setEditFinId]  = useState(null)
  const [showHRForm,   setShowHRForm]   = useState(false); const [editHRId,   setEditHRId]   = useState(null)
  const [showQCForm,   setShowQCForm]   = useState(false); const [editQCId,   setEditQCId]   = useState(null)

  // ── CRUD form field state ─────────────────────────
  const [invF,  setInvF]  = useState({ name:'', sku:'', category:'Raw Material', quantity:0, unit:'units', reorder_point:0, unit_cost:0, location:'', supplier:'' })
  const [prodF, setProdF] = useState({ product:'', quantity:0, start_date:'', end_date:'', assigned_to:'', status:'Planned', completion_pct:0 })
  const [poF,   setPoF]   = useState({ supplier:'', item:'', quantity:0, unit:'units', unit_price:0, expected_date:'' })
  const [soF,   setSoF]   = useState({ customer:'', product:'', quantity:0, unit_price:0, delivery_date:'', status:'Pending' })
  const [finF,  setFinF]  = useState({ type:'Revenue', description:'', amount:0, category:'Sales', status:'Pending' })
  const [hrF,   setHrF]   = useState({ name:'', department:'Production', designation:'', salary:0, join_date:'', status:'Active', attendance_pct:100 })
  const [qcF,   setQcF]   = useState({ product:'', batch:'', result:'Pass', defects:0, inspector:'', notes:'' })

  // ── AI ────────────────────────────────────────────
  const [aiHistory, setAiHistory] = useState([{
    role: 'assistant',
    content: "Namaste! I'm Saarthi, your ERP AI assistant.\n• \"Check stock level of Steel Rods\"\n• \"Increase copper wire by 200 meters\"\n• \"Create a PO for 100 bearings from SKF\"\n• \"Send daily report to manager@company.com\""
  }])
  const [aiInput,   setAiInput]   = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef(null)

  // ── Supplier Finder ────────────────────────────────
  const [supQ,      setSupQ]      = useState({ product_name:'', quantity:'', specs:'', location:'India', budget_range:'' })
  const [suppliers, setSuppliers] = useState(null)
  const [supLoading,setSupLoading]= useState(false)

  // ── LeadForge ─────────────────────────────────────
  const [icp, setIcp] = useState({
    product_description: 'Manufacturing ERP with AI sales coaching',
    target_industry:     'B2B Manufacturing, Engineering',
    company_size:        '50-500 employees',
    revenue_range:       '50-500 Cr INR',
    seed_accounts:       'Tata Motors, Bharat Forge, L&T',
  })
  const [lfLoading, setLfLoading] = useState(false)

  // ── VoiceCoach ────────────────────────────────────
  const [selectedLead,  setSelectedLead]  = useState(null)
  const [sessionId,     setSessionId]     = useState('')
  const [transcript,    setTranscript]    = useState([])
  const [chatInput,     setChatInput]     = useState('')
  const [coachReport,   setCoachReport]   = useState(null)
  const [sessionLoading,setSessionLoading]= useState(false)

  // ── Reports ───────────────────────────────────────
  const [reportForm,   setReportForm]   = useState({ email:'', whatsapp:'', telegram:'', frequency:'daily' })
  const [reportResult, setReportResult] = useState([])
  const [repLoading,   setRepLoading]   = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  // ── Data loaders ──────────────────────────────────
  const loadDash = () => api('/api/dashboard').then(setDashboard).catch(() => {})
  const loadInv  = () => api('/api/inventory').then(d => setInventory(d.items || [])).catch(() => {})
  const loadProd = () => api('/api/production').then(d => setProduction(d.orders || [])).catch(() => {})
  const loadPO   = () => api('/api/procurement').then(d => setProcurement(d.orders || [])).catch(() => {})
  const loadSO   = () => api('/api/sales').then(d => setSales(d.orders || [])).catch(() => {})
  const loadFin  = () => api('/api/finance').then(setFinance).catch(() => {})
  const loadHR   = () => api('/api/hr').then(setHr).catch(() => {})
  const loadQC   = () => api('/api/quality').then(setQuality).catch(() => {})
  const loadLeads= () => api('/api/leadforge/leads').then(d => setLeads(d.leads || [])).catch(() => {})

  const reloadAll = () => Promise.all([loadDash(), loadInv(), loadProd(), loadPO(), loadSO(), loadFin(), loadHR(), loadQC()])

  useEffect(() => {
    if (tab === 'dashboard')   loadDash()
    if (tab === 'inventory')   loadInv()
    if (tab === 'production')  loadProd()
    if (tab === 'procurement') loadPO()
    if (tab === 'sales')       loadSO()
    if (tab === 'finance')     loadFin()
    if (tab === 'hr')          loadHR()
    if (tab === 'quality')     loadQC()
    if (tab === 'leadforge')   loadLeads()
  }, [tab])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [aiHistory])

  // ── CRUD helpers ──────────────────────────────────
  // Generic save: POST or PUT then reset form + reload
  const crudSave = async (url, method, body, resetFn, reloadFn, msg) => {
    try { await api(url, method, body); resetFn(); reloadFn(); showToast(msg) }
    catch (e) { showToast('Error: ' + e.message) }
  }
  const crudDel = async (url, reloadFn) => {
    if (!confirm('Delete this record?')) return
    try { await api(url, 'DELETE'); reloadFn(); showToast('Deleted') }
    catch (e) { showToast('Error: ' + e.message) }
  }

  // Inventory
  const resetInv = () => { setShowInvForm(false); setEditInvId(null); setInvF({ name:'', sku:'', category:'Raw Material', quantity:0, unit:'units', reorder_point:0, unit_cost:0, location:'', supplier:'' }) }
  const saveInv  = () => crudSave(editInvId ? `/api/inventory/${editInvId}` : '/api/inventory', editInvId ? 'PUT' : 'POST', invF, resetInv, loadInv, 'Item saved!')
  const delInv   = id => crudDel(`/api/inventory/${id}`, loadInv)

  // Production
  const resetProd = () => { setShowProdForm(false); setEditProdId(null); setProdF({ product:'', quantity:0, start_date:'', end_date:'', assigned_to:'', status:'Planned', completion_pct:0 }) }
  const saveProd  = () => crudSave(editProdId ? `/api/production/${editProdId}` : '/api/production', editProdId ? 'PUT' : 'POST', prodF, resetProd, loadProd, 'Work order saved!')
  const delProd   = id => crudDel(`/api/production/${id}`, loadProd)

  // Procurement
  const resetPO = () => { setShowPOForm(false); setEditPOId(null); setPoF({ supplier:'', item:'', quantity:0, unit:'units', unit_price:0, expected_date:'' }) }
  const savePO  = () => crudSave(editPOId ? `/api/procurement/${editPOId}` : '/api/procurement', editPOId ? 'PUT' : 'POST', poF, resetPO, loadPO, 'Purchase order saved!')
  const delPO   = id => crudDel(`/api/procurement/${id}`, loadPO)

  // Sales
  const resetSO = () => { setShowSOForm(false); setEditSOId(null); setSoF({ customer:'', product:'', quantity:0, unit_price:0, delivery_date:'', status:'Pending' }) }
  const saveSO  = () => crudSave(editSOId ? `/api/sales/${editSOId}` : '/api/sales', editSOId ? 'PUT' : 'POST', soF, resetSO, loadSO, 'Sales order saved!')
  const delSO   = id => crudDel(`/api/sales/${id}`, loadSO)

  // Finance
  const resetFin = () => { setShowFinForm(false); setEditFinId(null); setFinF({ type:'Revenue', description:'', amount:0, category:'Sales', status:'Pending' }) }
  const saveFin  = () => crudSave(editFinId ? `/api/finance/${editFinId}` : '/api/finance', editFinId ? 'PUT' : 'POST', finF, resetFin, loadFin, 'Entry saved!')
  const delFin   = id => crudDel(`/api/finance/${id}`, loadFin)

  // HR
  const resetHR = () => { setShowHRForm(false); setEditHRId(null); setHrF({ name:'', department:'Production', designation:'', salary:0, join_date:'', status:'Active', attendance_pct:100 }) }
  const saveHR  = () => crudSave(editHRId ? `/api/hr/${editHRId}` : '/api/hr', editHRId ? 'PUT' : 'POST', hrF, resetHR, loadHR, 'Employee saved!')
  const delHR   = id => crudDel(`/api/hr/${id}`, loadHR)

  // Quality
  const resetQC = () => { setShowQCForm(false); setEditQCId(null); setQcF({ product:'', batch:'', result:'Pass', defects:0, inspector:'', notes:'' }) }
  const saveQC  = () => crudSave(editQCId ? `/api/quality/${editQCId}` : '/api/quality', editQCId ? 'PUT' : 'POST', qcF, resetQC, loadQC, 'Inspection saved!')
  const delQC   = id => crudDel(`/api/quality/${id}`, loadQC)

  // ── AI chat ───────────────────────────────────────
  const sendAI = async () => {
    if (!aiInput.trim() || aiLoading) return
    const msg = aiInput.trim(); setAiInput('')
    setAiHistory(h => [...h, { role: 'user', content: msg }])
    setAiLoading(true)
    try {
      const res = await api('/api/ai/chat', 'POST', {
        message: msg,
        history: aiHistory.slice(-8).map(m => ({ role: m.role, content: m.content }))
      })
      setAiHistory(h => [...h, { role: 'assistant', content: res.reply, action_result: res.action_result || undefined }])
      if (res.action) {
        await reloadAll()
        if (res.action_result) showToast(res.action_result.replace(/^[✅❌⚠]\s*/, ''))
      }
    } catch {
      setAiHistory(h => [...h, { role: 'assistant', content: "Sorry, couldn't process that. Please try again." }])
    }
    setAiLoading(false)
  }

  // ── Supplier Finder ───────────────────────────────
  const findSuppliers = async () => {
    if (!supQ.product_name) return
    setSupLoading(true)
    try { setSuppliers(await api('/api/suppliers/find', 'POST', supQ)) }
    catch { showToast('Supplier search failed') }
    setSupLoading(false)
  }

  // ── LeadForge ─────────────────────────────────────
  const generateLeads = async () => {
    setLfLoading(true)
    try {
      const res = await api('/api/leadforge/generate', 'POST', {
        ...icp,
        seed_accounts: icp.seed_accounts.split(',').map(s => s.trim())
      })
      setLeads(res.leads || [])
      showToast(`Generated ${res.leads?.length || 0} leads`)
    } catch { showToast('Lead generation failed') }
    setLfLoading(false)
  }

  // ── VoiceCoach ────────────────────────────────────
  const startSession = async lead => {
    setSelectedLead(lead); setTranscript([]); setCoachReport(null)
    setTab('voicecoach'); setSessionLoading(true)
    try {
      // MongoDB _id is the correct field
      const res = await api('/api/voicecoach/start', 'POST', { lead_id: lead._id, rep_name: 'You' })
      setSessionId(res.session_id)
      setTranscript([{ role: 'assistant', content: res.opening }])
    } catch { showToast('Failed to start session') }
    setSessionLoading(false)
  }

  const sendCoachMsg = async () => {
    if (!chatInput.trim() || sessionLoading) return
    const txt = chatInput.trim(); setChatInput('')
    setTranscript(t => [...t, { role: 'user', content: txt }])
    setSessionLoading(true)
    try {
      const res = await api('/api/voicecoach/chat', 'POST', { session_id: sessionId, content: txt })
      setTranscript(t => [...t, { role: 'assistant', content: res.reply }])
    } catch { showToast('Send failed') }
    setSessionLoading(false)
  }

  const getCoachReport = async () => {
    setSessionLoading(true)
    try { setCoachReport(await api('/api/voicecoach/report', 'POST', { session_id: sessionId, transcript })) }
    catch { showToast('Report failed') }
    setSessionLoading(false)
  }

  // ── Reports ───────────────────────────────────────
  const sendReport = async () => {
    setRepLoading(true); setReportResult([])
    try {
      const res = await api('/api/reports/send', 'POST', {
        email:     reportForm.email     || undefined,
        whatsapp:  reportForm.whatsapp  || undefined,
        telegram:  reportForm.telegram  || undefined,
        frequency: reportForm.frequency,
        modules:   ['inventory', 'production', 'sales', 'finance'],
      })
      const msgs = (res.results || []).map(r => ({
        ok:  r.success === true || String(r.message).includes('sent'),
        msg: `${String(r.medium || '').toUpperCase()}: ${r.message}`,
      }))
      setReportResult(msgs.length ? msgs : [{ ok: false, msg: '⚠ No response — check backend logs' }])
    } catch (e) {
      setReportResult([{ ok: false, msg: 'Error: ' + e.message }])
    }
    setRepLoading(false)
  }

  // ── NAV items ─────────────────────────────────────
  const NAV = [
    ['dashboard',   '📊', 'Dashboard'],
    ['ai',          '🤖', 'AI Assistant'],
    ['inventory',   '📦', 'Inventory'],
    ['production',  '🏭', 'Production'],
    ['procurement', '🛒', 'Procurement'],
    ['sales',       '💼', 'Sales'],
    ['finance',     '💰', 'Finance'],
    ['hr',          '👥', 'HR'],
    ['quality',     '✅', 'Quality'],
    ['suppliers',   '🔍', 'Supplier Finder'],
    ['leadforge',   '⚡', 'LeadForge'],
    ['voicecoach',  '🎙', 'VoiceCoach'],
    ['reports',     '📧', 'Daily Reports'],
  ]

  // ── Render ────────────────────────────────────────
  return (
    <div className="app">
      {toast && <div className="toast">{toast}</div>}

      {/* TOPBAR */}
      <div className="topbar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <div>
            <div className="logo-text">Saarthi ERP</div>
            <div className="logo-sub">Manufacturing Intelligence Platform</div>
          </div>
        </div>
        <div className="status-dot">
          <div className="dot" />
          <span>Groq AI Live</span>
        </div>
      </div>

      <div className="body">
        {/* SIDEBAR */}
        <nav className="sidebar">
          {NAV.map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-btn ${tab === id ? 'active' : ''}`}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>

        {/* MAIN */}
        <div className="main">

          {/* ═══ DASHBOARD ═══ */}
          {tab === 'dashboard' && (
            <div>
              <div className="page-header">
                <div>
                  <div className="page-title">Dashboard</div>
                  <div className="page-sub">Real-time overview of manufacturing operations</div>
                </div>
                <button className="btn btn-ghost" onClick={loadDash}>↻ Refresh</button>
              </div>
              <div className="accent-bar" />

              <div className="grid4" style={{ marginBottom: 16 }}>
                {[
                  { label: 'Inventory Items',    value: dashboard.total_inventory_items ?? '—',  sub: `${(dashboard.low_stock_items || []).length} low stock`,  warn: (dashboard.low_stock_items || []).length > 0 },
                  { label: 'Active Production',  value: dashboard.active_production_orders ?? '—',sub: 'work orders' },
                  { label: 'Open Sales Orders',  value: dashboard.open_sales_orders ?? '—',       sub: 'pending delivery' },
                  { label: 'Net Profit',         value: INR(dashboard.net_profit),                sub: 'revenue − expenses', warn: (dashboard.net_profit || 0) < 0 },
                  { label: 'Inventory Value',    value: INR(dashboard.inventory_value),            sub: 'total stock value' },
                  { label: 'Total Employees',    value: dashboard.total_employees ?? '—',          sub: `${dashboard.employees_on_leave || 0} on leave` },
                  { label: 'Pending POs',        value: dashboard.pending_purchase_orders ?? '—',  sub: 'purchase orders' },
                  { label: 'Total Revenue',      value: INR(dashboard.total_revenue),              sub: 'received' },
                ].map(m => (
                  <div key={m.label} className="stat-card" style={m.warn ? { borderColor: 'rgba(239,68,68,.5)' } : {}}>
                    <div className="stat-label">{m.label}</div>
                    <div className="stat-value" style={m.warn ? { color: '#f87171' } : {}}>{m.value}</div>
                    <div className="stat-sub">{m.sub}</div>
                  </div>
                ))}
              </div>

              {(dashboard.low_stock_items || []).length > 0 && (
                <div className="alert alert-red" style={{ marginBottom: 14 }}>
                  ⚠ Low Stock: {(dashboard.low_stock_items || []).map(i => `${i.name} (${i.qty} left)`).join(' · ')}
                </div>
              )}

              <div className="grid3">
                <div className="card">
                  <div className="card-title">Recent Sales</div>
                  {(dashboard.recent_sales || []).map(s => (
                    <div key={s._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{s.customer}</div>
                        <div style={{ color:'var(--text3)', fontSize:11 }}>{s.product}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ color:'#4ade80' }}>{INR(s.total)}</div>
                        <Badge s={s.status} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">Recent Finance</div>
                  {(dashboard.recent_finance || []).map(f => (
                    <div key={f._id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:12 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>{String(f.description).substring(0, 28)}</div>
                        <div style={{ color:'var(--text3)', fontSize:11 }}>{f.category}</div>
                      </div>
                      <div style={{ fontWeight:600, color: f.type === 'Revenue' ? '#4ade80' : '#f87171' }}>
                        {f.type === 'Revenue' ? '+' : '-'}{INR(f.amount)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="card">
                  <div className="card-title">Production Status</div>
                  {(dashboard.recent_production || []).map(p => (
                    <div key={p._id} style={{ padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:6 }}>
                        <span style={{ fontWeight:600 }}>{p.product}</span>
                        <Badge s={p.status} />
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${p.completion_pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ AI ASSISTANT ═══ */}
          {tab === 'ai' && (
            <div style={{ maxWidth: 760, margin: '0 auto' }}>
              <div className="page-header">
                <div>
                  <div className="page-title">AI Assistant</div>
                  <div className="page-sub">Ask questions or give commands in plain English</div>
                </div>
              </div>
              <div className="accent-bar" />
              <div className="chat-container">
                <div className="chat-messages">
                  {aiHistory.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                      <div className="msg-label">{m.role === 'user' ? 'You' : 'Saarthi AI'}</div>
                      <div className="msg-bubble">{m.content}</div>
                      {m.action_result && (
                        <div className="action-result">{m.action_result}</div>
                      )}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="msg assistant">
                      <div className="msg-bubble">
                        <div className="typing"><span /><span /><span /></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="chat-input-row">
                  <input
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendAI()}
                    disabled={aiLoading}
                    placeholder='Try: "Check stock of Steel Rods" or "Increase copper wire by 200"'
                  />
                  <button className="btn btn-primary" onClick={sendAI} disabled={aiLoading}>
                    {aiLoading ? '...' : 'Send'}
                  </button>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                  {['Check stock level of Steel Rods', 'Increase steel rods by 500 kg', 'How many open sales orders?', 'Send report to manager@company.com'].map(s => (
                    <button key={s} onClick={() => setAiInput(s)}
                      style={{ fontSize:11, padding:'4px 10px', borderRadius:99, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text2)', cursor:'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ INVENTORY ═══ */}
          {tab === 'inventory' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Inventory</div><div className="page-sub">Real-time stock tracking</div></div>
                <button className="btn btn-primary" onClick={() => { resetInv(); setShowInvForm(true) }}>+ Add Item</button>
              </div>
              <div className="accent-bar" />
              {showInvForm && (
                <FormWrap title={editInvId ? 'Edit Item' : 'Add New Item'} onClose={resetInv} onSave={saveInv} saveLabel={editInvId ? 'Update' : 'Save Item'}>
                  <div className="form-grid">
                    {[['Item Name','name','Steel Rods'],['SKU','sku','STL-001'],['Location','location','Warehouse A'],['Supplier','supplier','Tata Steel']].map(([l,k,p])=>(
                      <div key={k} className="field"><label>{l}</label><input value={invF[k]} onChange={e=>setInvF({...invF,[k]:e.target.value})} placeholder={p}/></div>
                    ))}
                    <div className="field"><label>Category</label>
                      <select value={invF.category} onChange={e=>setInvF({...invF,category:e.target.value})}>
                        <option>Raw Material</option><option>Finished Goods</option><option>Spare Parts</option><option>Components</option>
                      </select>
                    </div>
                    <div className="field"><label>Unit</label><input value={invF.unit} onChange={e=>setInvF({...invF,unit:e.target.value})} placeholder="kg / units / meters"/></div>
                    <div className="field"><label>Quantity</label><input type="number" onFocus={e=>e.target.select()} value={invF.quantity} onChange={e=>setInvF({...invF,quantity:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Reorder Point</label><input type="number" onFocus={e=>e.target.select()} value={invF.reorder_point} onChange={e=>setInvF({...invF,reorder_point:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Unit Cost (₹)</label><input type="number" onFocus={e=>e.target.select()} value={invF.unit_cost} onChange={e=>setInvF({...invF,unit_cost:e.target.value===''?'':+e.target.value})}/></div>
                  </div>
                </FormWrap>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr>{['Item','SKU','Category','Stock','Unit','Reorder','Unit Cost','Location','Supplier','Status','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {inventory.map(i => (
                      <tr key={i._id}>
                        <td className="bold">{i.name}</td>
                        <td style={{color:'var(--text3)'}}>{i.sku}</td>
                        <td><span className="badge badge-blue">{i.category}</span></td>
                        <td className={i.quantity <= i.reorder_point ? 'red' : 'green'}>{i.quantity}</td>
                        <td>{i.unit}</td>
                        <td>{i.reorder_point}</td>
                        <td>{INR(i.unit_cost)}</td>
                        <td style={{color:'var(--text3)'}}>{i.location}</td>
                        <td style={{color:'var(--text3)'}}>{i.supplier}</td>
                        <td><Badge s={i.quantity <= i.reorder_point ? 'Pending' : 'Active'} /></td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={() => { setEditInvId(i._id); setInvF({name:i.name,sku:i.sku,category:i.category,quantity:i.quantity,unit:i.unit,reorder_point:i.reorder_point,unit_cost:i.unit_cost,location:i.location,supplier:i.supplier}); setShowInvForm(true) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => delInv(i._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ PRODUCTION ═══ */}
          {tab === 'production' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Production Orders</div><div className="page-sub">Work order tracking</div></div>
                <button className="btn btn-primary" onClick={() => { resetProd(); setShowProdForm(true) }}>+ New Work Order</button>
              </div>
              <div className="accent-bar" />
              {showProdForm && (
                <FormWrap title={editProdId ? 'Edit Work Order' : 'New Work Order'} onClose={resetProd} onSave={saveProd} saveLabel={editProdId ? 'Update' : 'Create'}>
                  <div className="form-grid form-grid-2">
                    <div className="field"><label>Product Name</label><input value={prodF.product} onChange={e=>setProdF({...prodF,product:e.target.value})} placeholder="Electric Motor 3HP"/></div>
                    <div className="field"><label>Quantity</label><input type="number" onFocus={e=>e.target.select()} value={prodF.quantity} onChange={e=>setProdF({...prodF,quantity:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Start Date</label><input type="date" value={prodF.start_date} onChange={e=>setProdF({...prodF,start_date:e.target.value})}/></div>
                    <div className="field"><label>End Date</label><input type="date" value={prodF.end_date} onChange={e=>setProdF({...prodF,end_date:e.target.value})}/></div>
                    <div className="field"><label>Assigned To</label><input value={prodF.assigned_to} onChange={e=>setProdF({...prodF,assigned_to:e.target.value})} placeholder="Team Alpha"/></div>
                    <div className="field"><label>Status</label>
                      <select value={prodF.status} onChange={e=>setProdF({...prodF,status:e.target.value})}>
                        <option>Planned</option><option>In Progress</option><option>Completed</option>
                      </select>
                    </div>
                    {prodF.status === 'In Progress' && (
                      <div className="field"><label>Completion %</label><input type="number" min="0" max="100" onFocus={e=>e.target.select()} value={prodF.completion_pct} onChange={e=>setProdF({...prodF,completion_pct:e.target.value===''?'':+e.target.value})}/></div>
                    )}
                  </div>
                </FormWrap>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {production.map(p => (
                  <div key={p._id} className="card">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:14 }}>{p.product}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{p.order_no} · {p.assigned_to}</div>
                      </div>
                      <Badge s={p.status} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, fontSize:11, marginBottom:10 }}>
                      <span><span style={{color:'var(--text3)'}}>Qty: </span><b>{p.quantity}</b></span>
                      <span><span style={{color:'var(--text3)'}}>Start: </span><b>{p.start_date}</b></span>
                      <span><span style={{color:'var(--text3)'}}>End: </span><b>{p.end_date}</b></span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                      <div className="progress-bar" style={{ flex:1 }}>
                        <div className="progress-fill" style={{ width:`${p.completion_pct}%` }} />
                      </div>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>{p.completion_pct}%</span>
                    </div>
                    <div style={{ display:'flex', gap:6, borderTop:'1px solid var(--border)', paddingTop:10 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditProdId(p._id); setProdF({product:p.product,quantity:p.quantity,start_date:p.start_date,end_date:p.end_date,assigned_to:p.assigned_to,status:p.status,completion_pct:p.completion_pct}); setShowProdForm(true) }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => delProd(p._id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ PROCUREMENT ═══ */}
          {tab === 'procurement' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Purchase Orders</div><div className="page-sub">Procurement management</div></div>
                <button className="btn btn-primary" onClick={() => { resetPO(); setShowPOForm(true) }}>+ New Purchase Order</button>
              </div>
              <div className="accent-bar" />
              {showPOForm && (
                <FormWrap title={editPOId ? 'Edit PO' : 'New Purchase Order'} onClose={resetPO} onSave={savePO} saveLabel={editPOId ? 'Update' : 'Create PO'}>
                  <div className="form-grid">
                    <div className="field"><label>Supplier</label><input value={poF.supplier} onChange={e=>setPoF({...poF,supplier:e.target.value})} placeholder="Tata Steel"/></div>
                    <div className="field"><label>Item</label><input value={poF.item} onChange={e=>setPoF({...poF,item:e.target.value})} placeholder="Steel Rods"/></div>
                    <div className="field"><label>Unit</label><input value={poF.unit} onChange={e=>setPoF({...poF,unit:e.target.value})} placeholder="kg / units"/></div>
                    <div className="field"><label>Quantity</label><input type="number" onFocus={e=>e.target.select()} value={poF.quantity} onChange={e=>setPoF({...poF,quantity:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Unit Price (₹)</label><input type="number" onFocus={e=>e.target.select()} value={poF.unit_price} onChange={e=>setPoF({...poF,unit_price:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Expected Date</label><input type="date" value={poF.expected_date} onChange={e=>setPoF({...poF,expected_date:e.target.value})}/></div>
                  </div>
                  <p style={{ fontSize:12, color:'var(--text2)' }}>Total: <b style={{color:'var(--text)'}}>{INR(poF.quantity * poF.unit_price)}</b></p>
                </FormWrap>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr>{['PO Number','Supplier','Item','Qty','Unit Price','Total','Status','Order Date','Expected','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {procurement.map(p => (
                      <tr key={p._id}>
                        <td className="indigo">{p.po_number}</td>
                        <td className="bold">{p.supplier}</td>
                        <td>{p.item}</td>
                        <td>{p.quantity} {p.unit}</td>
                        <td>{INR(p.unit_price)}</td>
                        <td className="bold">{INR(p.total)}</td>
                        <td><Badge s={p.status}/></td>
                        <td style={{color:'var(--text3)'}}>{p.order_date}</td>
                        <td style={{color:'var(--text3)'}}>{p.expected_date}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={() => { setEditPOId(p._id); setPoF({supplier:p.supplier,item:p.item,quantity:p.quantity,unit:p.unit,unit_price:p.unit_price,expected_date:p.expected_date||''}); setShowPOForm(true) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => delPO(p._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ SALES ═══ */}
          {tab === 'sales' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Sales Orders</div><div className="page-sub">Customer order management</div></div>
                <button className="btn btn-primary" onClick={() => { resetSO(); setShowSOForm(true) }}>+ New Sales Order</button>
              </div>
              <div className="accent-bar" />
              {showSOForm && (
                <FormWrap title={editSOId ? 'Edit Sales Order' : 'New Sales Order'} onClose={resetSO} onSave={saveSO} saveLabel={editSOId ? 'Update' : 'Create SO'}>
                  <div className="form-grid">
                    <div className="field"><label>Customer</label><input value={soF.customer} onChange={e=>setSoF({...soF,customer:e.target.value})} placeholder="Bharat Electronics"/></div>
                    <div className="field"><label>Product</label><input value={soF.product} onChange={e=>setSoF({...soF,product:e.target.value})} placeholder="Electric Motor 3HP"/></div>
                    <div className="field"><label>Quantity</label><input type="number" onFocus={e=>e.target.select()} value={soF.quantity} onChange={e=>setSoF({...soF,quantity:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Unit Price (₹)</label><input type="number" onFocus={e=>e.target.select()} value={soF.unit_price} onChange={e=>setSoF({...soF,unit_price:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Delivery Date</label><input type="date" value={soF.delivery_date} onChange={e=>setSoF({...soF,delivery_date:e.target.value})}/></div>
                    <div className="field"><label>Status</label>
                      <select value={soF.status} onChange={e=>setSoF({...soF,status:e.target.value})}>
                        <option>Pending</option><option>Processing</option><option>Delivered</option>
                      </select>
                    </div>
                  </div>
                  <p style={{ fontSize:12, color:'var(--text2)' }}>Total: <b style={{color:'var(--text)'}}>{INR(soF.quantity * soF.unit_price)}</b></p>
                </FormWrap>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr>{['Order No','Customer','Product','Qty','Unit Price','Total','Status','Order Date','Delivery','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s._id}>
                        <td className="indigo">{s.order_no}</td>
                        <td className="bold">{s.customer}</td>
                        <td>{s.product}</td>
                        <td>{s.quantity}</td>
                        <td>{INR(s.unit_price)}</td>
                        <td className="green">{INR(s.total)}</td>
                        <td><Badge s={s.status}/></td>
                        <td style={{color:'var(--text3)'}}>{s.order_date}</td>
                        <td style={{color:'var(--text3)'}}>{s.delivery_date || '—'}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={() => { setEditSOId(s._id); setSoF({customer:s.customer,product:s.product,quantity:s.quantity,unit_price:s.unit_price,delivery_date:s.delivery_date||'',status:s.status}); setShowSOForm(true) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => delSO(s._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ FINANCE ═══ */}
          {tab === 'finance' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Finance</div><div className="page-sub">Revenue and expense tracking</div></div>
                <button className="btn btn-primary" onClick={() => { resetFin(); setShowFinForm(true) }}>+ Add Entry</button>
              </div>
              <div className="accent-bar" />
              <div className="grid3" style={{ marginBottom:16 }}>
                {[{ label:'Total Revenue', value:INR(finance.total_revenue), color:'#4ade80' },{ label:'Total Expenses', value:INR(finance.total_expenses), color:'#f87171' },{ label:'Net Profit', value:INR(finance.net_profit), color: finance.net_profit >= 0 ? '#4ade80' : '#f87171' }].map(m => (
                  <div key={m.label} className="stat-card">
                    <div className="stat-label">{m.label}</div>
                    <div className="stat-value" style={{ color: m.color }}>{m.value}</div>
                  </div>
                ))}
              </div>
              {showFinForm && (
                <FormWrap title={editFinId ? 'Edit Entry' : 'Add Finance Entry'} onClose={resetFin} onSave={saveFin} saveLabel={editFinId ? 'Update' : 'Save Entry'}>
                  <div className="form-grid form-grid-2">
                    <div className="field"><label>Type</label><select value={finF.type} onChange={e=>setFinF({...finF,type:e.target.value})}><option>Revenue</option><option>Expense</option></select></div>
                    <div className="field"><label>Amount (₹)</label><input type="number" onFocus={e=>e.target.select()} value={finF.amount} onChange={e=>setFinF({...finF,amount:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field" style={{gridColumn:'1/-1'}}><label>Description</label><input value={finF.description} onChange={e=>setFinF({...finF,description:e.target.value})} placeholder="e.g. Payment from customer"/></div>
                    <div className="field"><label>Category</label><select value={finF.category} onChange={e=>setFinF({...finF,category:e.target.value})}><option>Sales</option><option>Raw Materials</option><option>Payroll</option><option>Utilities</option><option>Other</option></select></div>
                    <div className="field"><label>Status</label><select value={finF.status} onChange={e=>setFinF({...finF,status:e.target.value})}><option>Pending</option><option>Received</option><option>Paid</option></select></div>
                  </div>
                </FormWrap>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr>{['Type','Description','Amount','Category','Date','Status','Actions'].map(h=><th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {(finance.entries || []).map(f => (
                      <tr key={f._id}>
                        <td style={{ fontWeight:700, color: f.type === 'Revenue' ? '#4ade80' : '#f87171' }}>{f.type}</td>
                        <td>{f.description}</td>
                        <td style={{ fontWeight:600, color: f.type === 'Revenue' ? '#4ade80' : '#f87171' }}>{f.type === 'Revenue' ? '+' : '-'}{INR(f.amount)}</td>
                        <td style={{color:'var(--text3)'}}>{f.category}</td>
                        <td style={{color:'var(--text3)'}}>{f.date}</td>
                        <td><Badge s={f.status}/></td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={() => { setEditFinId(f._id); setFinF({type:f.type,description:f.description,amount:f.amount,category:f.category,status:f.status}); setShowFinForm(true) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => delFin(f._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ HR ═══ */}
          {tab === 'hr' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Human Resources</div><div className="page-sub">Employee management</div></div>
                <button className="btn btn-primary" onClick={() => { resetHR(); setShowHRForm(true) }}>+ Add Employee</button>
              </div>
              <div className="accent-bar" />
              <div className="grid3" style={{ marginBottom:16 }}>
                {[{ label:'Total Employees', value: hr.total }, { label:'Total Payroll', value: `${INR(hr.total_payroll)}/mo` }, { label:'Active', value: (hr.employees || []).filter(e => e.status === 'Active').length }].map(m => (
                  <div key={m.label} className="stat-card"><div className="stat-label">{m.label}</div><div className="stat-value">{m.value}</div></div>
                ))}
              </div>
              {showHRForm && (
                <FormWrap title={editHRId ? 'Edit Employee' : 'Add Employee'} onClose={resetHR} onSave={saveHR} saveLabel={editHRId ? 'Update' : 'Add Employee'}>
                  <div className="form-grid form-grid-2">
                    <div className="field"><label>Full Name</label><input value={hrF.name} onChange={e=>setHrF({...hrF,name:e.target.value})} placeholder="Rajesh Kumar"/></div>
                    <div className="field"><label>Department</label><select value={hrF.department} onChange={e=>setHrF({...hrF,department:e.target.value})}><option>Production</option><option>Sales</option><option>Procurement</option><option>Finance</option><option>Quality</option><option>HR</option><option>Management</option></select></div>
                    <div className="field"><label>Designation</label><input value={hrF.designation} onChange={e=>setHrF({...hrF,designation:e.target.value})} placeholder="Senior Engineer"/></div>
                    <div className="field"><label>Salary (₹/month)</label><input type="number" onFocus={e=>e.target.select()} value={hrF.salary} onChange={e=>setHrF({...hrF,salary:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Join Date</label><input type="date" value={hrF.join_date} onChange={e=>setHrF({...hrF,join_date:e.target.value})}/></div>
                    <div className="field"><label>Status</label><select value={hrF.status} onChange={e=>setHrF({...hrF,status:e.target.value})}><option>Active</option><option>On Leave</option><option>Resigned</option></select></div>
                    <div className="field"><label>Attendance %</label><input type="number" min="0" max="100" onFocus={e=>e.target.select()} value={hrF.attendance_pct} onChange={e=>setHrF({...hrF,attendance_pct:e.target.value===''?'':+e.target.value})}/></div>
                  </div>
                </FormWrap>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(hr.employees || []).map(e => (
                  <div key={e._id} className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
                    <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,var(--indigo),#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0 }}>
                      {e.name.charAt(0)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700 }}>{e.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)' }}>{e.designation} · {e.department}</div>
                    </div>
                    <div style={{ textAlign:'right', fontSize:12 }}>
                      <div style={{ fontWeight:600 }}>{INR(e.salary)}/mo</div>
                      <div style={{ color:'var(--text3)', fontSize:11 }}>Attendance: {e.attendance_pct}%</div>
                    </div>
                    <Badge s={e.status} />
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditHRId(e._id); setHrF({name:e.name,department:e.department,designation:e.designation,salary:e.salary,join_date:e.join_date||'',status:e.status,attendance_pct:e.attendance_pct}); setShowHRForm(true) }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => delHR(e._id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ QUALITY ═══ */}
          {tab === 'quality' && (
            <div>
              <div className="page-header">
                <div><div className="page-title">Quality Management</div><div className="page-sub">Inspection records</div></div>
                <button className="btn btn-primary" onClick={() => { resetQC(); setShowQCForm(true) }}>+ Add Inspection</button>
              </div>
              <div className="accent-bar" />
              <div className="stat-card" style={{ marginBottom:16, display:'inline-block', padding:'12px 20px' }}>
                <div className="stat-label">Overall Pass Rate</div>
                <div className="stat-value" style={{ color:'#4ade80' }}>{(quality.pass_rate || 0).toFixed(1)}%</div>
              </div>
              {showQCForm && (
                <FormWrap title={editQCId ? 'Edit Inspection' : 'Add Inspection'} onClose={resetQC} onSave={saveQC} saveLabel={editQCId ? 'Update' : 'Save'}>
                  <div className="form-grid form-grid-2">
                    <div className="field"><label>Product</label><input value={qcF.product} onChange={e=>setQcF({...qcF,product:e.target.value})} placeholder="Electric Motor 3HP"/></div>
                    <div className="field"><label>Batch No</label><input value={qcF.batch} onChange={e=>setQcF({...qcF,batch:e.target.value})} placeholder="BATCH-003"/></div>
                    <div className="field"><label>Result</label><select value={qcF.result} onChange={e=>setQcF({...qcF,result:e.target.value})}><option>Pass</option><option>Fail</option></select></div>
                    <div className="field"><label>Defects</label><input type="number" min="0" onFocus={e=>e.target.select()} value={qcF.defects} onChange={e=>setQcF({...qcF,defects:e.target.value===''?'':+e.target.value})}/></div>
                    <div className="field"><label>Inspector</label><input value={qcF.inspector} onChange={e=>setQcF({...qcF,inspector:e.target.value})} placeholder="Vikram Singh"/></div>
                    <div className="field"><label>Notes</label><input value={qcF.notes} onChange={e=>setQcF({...qcF,notes:e.target.value})} placeholder="Optional"/></div>
                  </div>
                </FormWrap>
              )}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {(quality.inspections || []).map(q => (
                  <div key={q._id} className="card">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div>
                        <div style={{ fontWeight:700 }}>{q.product}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{q.inspection_no} · {q.date}</div>
                      </div>
                      <Badge s={q.result} />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, fontSize:11, marginBottom:8 }}>
                      <span><span style={{color:'var(--text3)'}}>Inspector: </span>{q.inspector}</span>
                      <span><span style={{color:'var(--text3)'}}>Defects: </span><span style={{color: q.defects > 0 ? '#f87171' : '#4ade80'}}>{q.defects}</span></span>
                      <span><span style={{color:'var(--text3)'}}>Batch: </span>{q.batch}</span>
                    </div>
                    {q.notes && <div style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:8 }}>{q.notes}</div>}
                    <div style={{ display:'flex', gap:6, borderTop:'1px solid var(--border)', paddingTop:8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setEditQCId(q._id); setQcF({product:q.product,batch:q.batch,result:q.result,defects:q.defects,inspector:q.inspector,notes:q.notes||''}); setShowQCForm(true) }}>Edit</button>
                      <button className="btn btn-danger btn-sm" onClick={() => delQC(q._id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SUPPLIER FINDER ═══ */}
          {tab === 'suppliers' && (
            <div>
              <div className="page-header"><div><div className="page-title">AI Supplier Finder</div><div className="page-sub">Describe what you need — AI finds best Indian suppliers</div></div></div>
              <div className="accent-bar" />
              <div className="grid2">
                <div className="card">
                  <div className="card-title">Requirement Details</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {[['Product / Material','product_name','Industrial Bearings, Copper Wire'],['Quantity Required','quantity','500 units/month'],['Location','location','India'],['Budget (INR)','budget_range','₹100-150/unit']].map(([l,k,p])=>(
                      <div key={k} className="field"><label>{l}</label><input value={supQ[k]} onChange={e=>setSupQ({...supQ,[k]:e.target.value})} placeholder={p}/></div>
                    ))}
                    <div className="field"><label>Specifications</label><textarea value={supQ.specs} onChange={e=>setSupQ({...supQ,specs:e.target.value})} placeholder="ISO certified, Grade A..."/></div>
                    <button className="btn btn-gold" onClick={findSuppliers} disabled={supLoading || !supQ.product_name} style={{ justifyContent:'center' }}>
                      {supLoading ? '🔍 Searching...' : '🔍 Find Best Suppliers'}
                    </button>
                  </div>
                </div>
                <div style={{ overflowY:'auto', maxHeight:'70vh' }}>
                  {!suppliers && !supLoading && <div className="empty"><div className="empty-icon">🔍</div><h3>No search yet</h3><p>Fill requirements and click Find Suppliers</p></div>}
                  {suppliers?.recommendation && <div className="alert alert-green" style={{marginBottom:10}}><b>🏆 Recommendation:</b> {suppliers.recommendation}</div>}
                  {(suppliers?.suppliers || []).map(s => (
                    <div key={s.id} className="item-card">
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div><div className="item-name">{s.company_name}</div><div className="item-meta">{s.location} · {s.specialisation}</div></div>
                        <span className="badge badge-gold">{s.match_score}% match</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:11, marginBottom:8 }}>
                        <span><span style={{color:'var(--text3)'}}>Price: </span>{s.estimated_price}</span>
                        <span><span style={{color:'var(--text3)'}}>Lead time: </span>{s.lead_time}</span>
                        <span><span style={{color:'var(--text3)'}}>Min order: </span>{s.min_order_qty}</span>
                        <span><span style={{color:'var(--text3)'}}>Rating: </span><span style={{color:'#fcd34d'}}>{'★'.repeat(Math.round(s.rating))} {s.rating}</span></span>
                      </div>
                      <p style={{ fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:6 }}>{s.review}</p>
                      <div className="tag-list">{(s.certifications||[]).map(c=><span key={c} className="tag">{c}</span>)}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>{s.contact_person} · {s.phone}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ LEADFORGE ═══ */}
          {tab === 'leadforge' && (
            <div>
              <div className="page-header"><div><div className="page-title">LeadForge — Sales Intelligence</div><div className="page-sub">AI discovers high-fit Indian B2B prospects</div></div></div>
              <div className="accent-bar" />
              <div className="grid2">
                <div className="card">
                  <div className="card-title">Ideal Customer Profile</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {[['Product Description','product_description','What you sell...','textarea'],['Target Industries','target_industry','B2B Manufacturing...','input'],['Company Size','company_size','50-500 employees','input'],['Revenue Range','revenue_range','50-500 Cr INR','input'],['Seed Accounts','seed_accounts','Tata Motors, L&T, BHEL','input']].map(([l,k,p,t])=>(
                      <div key={k} className="field">
                        <label>{l}</label>
                        {t === 'textarea'
                          ? <textarea value={icp[k]} onChange={e=>setIcp({...icp,[k]:e.target.value})} placeholder={p}/>
                          : <input value={icp[k]} onChange={e=>setIcp({...icp,[k]:e.target.value})} placeholder={p}/>}
                      </div>
                    ))}
                    <button className="btn btn-gold" onClick={generateLeads} disabled={lfLoading} style={{ justifyContent:'center' }}>
                      {lfLoading ? '⚡ Generating...' : '⚡ Generate Lead List'}
                    </button>
                  </div>
                </div>
                <div style={{ overflowY:'auto', maxHeight:'70vh' }}>
                  {leads.length === 0 && !lfLoading && <div className="empty"><div className="empty-icon">🎯</div><h3>No leads yet</h3><p>Fill ICP and click Generate</p></div>}
                  {leads.map(l => (
                    <div key={l._id} className="item-card">
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                        <div><div className="item-name">{l.company_name}</div><div className="item-meta">{l.location} · {l.employee_count} · {l.annual_revenue}</div></div>
                        <span className="badge badge-gold">{l.fit_score}% fit</span>
                      </div>
                      <p style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>{l.fit_reason}</p>
                      <div className="tag-list">{(l.pain_points||[]).map(p=><span key={p} className="pain-tag">{p}</span>)}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10, paddingTop:8, borderTop:'1px solid var(--border)' }}>
                        <div style={{ fontSize:11, color:'var(--text3)' }}><b style={{color:'var(--text2)'}}>{l.decision_maker?.name}</b> · {l.decision_maker?.role}</div>
                        <button className="btn btn-primary btn-sm" onClick={() => startSession(l)}>🎙 Practice Call</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ VOICECOACH ═══ */}
          {tab === 'voicecoach' && (
            <div>
              <div className="page-header"><div><div className="page-title">VoiceCoach — Sales Practice</div><div className="page-sub">Practice calls with AI buyer personas</div></div></div>
              <div className="accent-bar" />
              {!selectedLead ? (
                <div className="empty" style={{ paddingTop:80 }}>
                  <div className="empty-icon">🎙</div>
                  <h3>No session started</h3>
                  <p>Go to LeadForge and click Practice Call on any lead</p>
                  <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setTab('leadforge')}>Go to LeadForge →</button>
                </div>
              ) : (
                <div className="coach-layout">
                  <div className="coach-chat">
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,var(--indigo),var(--gold))', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, flexShrink:0 }}>
                        {selectedLead.decision_maker?.name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight:700, fontSize:13 }}>{selectedLead.decision_maker?.name}</div>
                        <div style={{ fontSize:11, color:'var(--text3)' }}>{selectedLead.decision_maker?.role} · {selectedLead.company_name}</div>
                      </div>
                      <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                        <span className="badge badge-green" style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ width:6, height:6, borderRadius:'50%', background:'#4ade80', display:'inline-block' }}/>Live
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={getCoachReport} disabled={sessionLoading || transcript.length < 4}>
                          📊 Get Report
                        </button>
                      </div>
                    </div>
                    <div className="tag-list" style={{ marginBottom:10 }}>
                      {(selectedLead.pain_points||[]).map(p=><span key={p} className="pain-tag">⚠ {p}</span>)}
                    </div>
                    <div className="chat-messages" style={{ flex:1 }}>
                      {transcript.map((m, i) => (
                        <div key={i} className={`msg ${m.role}`}>
                          <div className="msg-label">{m.role === 'user' ? 'You' : 'Buyer'}</div>
                          <div className="msg-bubble">{m.content}</div>
                        </div>
                      ))}
                      {sessionLoading && (
                        <div className="msg assistant">
                          <div className="msg-bubble"><div className="typing"><span/><span/><span/></div></div>
                        </div>
                      )}
                    </div>
                    <div className="chat-input-row" style={{ marginTop:10 }}>
                      <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendCoachMsg()} disabled={sessionLoading} placeholder="Type your sales message..."/>
                      <button className="btn btn-primary" onClick={sendCoachMsg} disabled={sessionLoading}>{sessionLoading ? '...' : 'Send'}</button>
                    </div>
                  </div>

                  <div className="coach-panel">
                    {!coachReport ? (
                      <div className="card">
                        <div className="card-title">Prospect Intel</div>
                        {[['Industry',selectedLead.industry],['Revenue',selectedLead.annual_revenue],['Size',selectedLead.employee_count],['Location',selectedLead.location]].map(([k,v])=>(
                          <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                            <span style={{color:'var(--text3)'}}>{k}</span><span>{v}</span>
                          </div>
                        ))}
                        <div style={{ fontSize:11, color:'var(--indigo2)', marginTop:10 }}>Have 4+ exchanges then click Get Report</div>
                      </div>
                    ) : (
                      <>
                        <div className="score-circle">
                          <div className="card-title">Coaching Report</div>
                          <div className="score-num" style={{ color: coachReport.overall_score >= 80 ? '#4ade80' : coachReport.overall_score >= 60 ? '#fcd34d' : '#f87171' }}>
                            {coachReport.overall_score}
                          </div>
                          <div className="score-level">{coachReport.readiness_level}</div>
                        </div>
                        <div className="card">
                          <div className="card-title">Dimensions</div>
                          {Object.entries(coachReport.dimensions || {}).map(([k, v]) => (
                            <div key={k} className="dim-bar">
                              <div className="dim-row">
                                <span style={{ textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</span>
                                <span>{v.score}</span>
                              </div>
                              <div className="progress-bar"><div className="progress-fill" style={{ width:`${v.score}%` }}/></div>
                              <div className="dim-feedback">{v.feedback}</div>
                            </div>
                          ))}
                        </div>
                        <div className="card">
                          <div className="card-title" style={{color:'#4ade80'}}>Strengths</div>
                          {(coachReport.top_strengths||[]).map(s=><div key={s} style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>✅ {s}</div>)}
                        </div>
                        <div className="card">
                          <div className="card-title" style={{color:'#fcd34d'}}>Improve</div>
                          {(coachReport.improvement_areas||[]).map(s=><div key={s} style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>⚠ {s}</div>)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ DAILY REPORTS ═══ */}
          {tab === 'reports' && (
            <div style={{ maxWidth:600, margin:'0 auto' }}>
              <div className="page-header"><div><div className="page-title">Daily Reports</div><div className="page-sub">Automated ERP reports via Email, WhatsApp, or Telegram</div></div></div>
              <div className="accent-bar" />
              <div className="card" style={{ marginBottom:14 }}>
                <div className="card-title">Schedule Report</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div className="field"><label>Email Address</label><input value={reportForm.email} onChange={e=>setReportForm({...reportForm,email:e.target.value})} placeholder="manager@company.com"/></div>
                  <div className="field"><label>WhatsApp Number</label><input value={reportForm.whatsapp} onChange={e=>setReportForm({...reportForm,whatsapp:e.target.value})} placeholder="+91-9876543210"/></div>
                  <div className="field">
                    <label>Telegram Chat ID <span style={{color:'#4ade80',fontWeight:400,textTransform:'none'}}>(recommended — instant, free)</span></label>
                    <input value={reportForm.telegram} onChange={e=>setReportForm({...reportForm,telegram:e.target.value})} placeholder="e.g. 987654321"/>
                    <div style={{fontSize:10,color:'var(--text3)',marginTop:4}}>Get ID: Telegram → search @userinfobot → send any message → copy your ID</div>
                  </div>
                  <div className="field"><label>Frequency</label>
                    <select value={reportForm.frequency} onChange={e=>setReportForm({...reportForm,frequency:e.target.value})}>
                      <option value="daily">Daily</option><option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" onClick={sendReport} disabled={repLoading || (!reportForm.email && !reportForm.whatsapp && !reportForm.telegram)} style={{justifyContent:'center'}}>
                    {repLoading ? '📤 Sending...' : '📤 Send & Schedule Report'}
                  </button>
                </div>
              </div>
              {reportResult.map((r, i) => (
                <div key={i} className={`report-result ${r.ok ? 'ok' : 'err'}`}>{r.ok ? '✅' : '❌'} {r.msg}</div>
              ))}
              <div className="card">
                <div className="card-title">Report Includes</div>
                {['📦 Inventory — stock levels, low-stock alerts','🏭 Production — active work orders','💰 Finance — revenue, expenses, net profit','🛒 Sales — open orders, pipeline','👥 HR — headcount, leave status'].map(s=>(
                  <div key={s} style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>{s}</div>
                ))}
                <div style={{fontSize:10,color:'var(--text3)',marginTop:8,paddingTop:8,borderTop:'1px solid var(--border)'}}>
                  💡 Telegram: instant, free · WhatsApp: Twilio sandbox (rejoin before testing) · Email: Gmail App Password
                </div>
              </div>
            </div>
          )}

        </div>{/* end .main */}
      </div>{/* end .body */}
    </div>
  )
}
