'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, exportToCSV, generateExportFilename } from '@/lib/utils'
import {
  Plus, Search, Download, Eye, CheckCircle, XCircle,
  X, Trash2, ChevronLeft, ChevronRight, RefreshCw, ArrowDownToLine
} from 'lucide-react'
import type { GoodsReceivedNote, Supplier, InventoryItem, Profile } from '@/types'

const PAGE_SIZE = 15

export default function StockInPage() {
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewGRN, setViewGRN] = useState<GoodsReceivedNote | null>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setUserProfile(data)
      }
    })
  }, [])

  useEffect(() => { loadGRNs() }, [page, search, statusFilter])

  async function loadGRNs() {
    setLoading(true)
    let q = supabase
      .from('goods_received_notes')
      .select('*, supplier:suppliers(id,name), received_by_profile:profiles!goods_received_notes_received_by_fkey(id,full_name), items:grn_items(id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) q = q.ilike('grn_number', `%${search}%`)
    if (statusFilter) q = q.eq('status', statusFilter)

    const { data, count } = await q
    setGrns(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  // Uses RPC function to update status and safely commit stock adjustments natively
  async function updateStatus(id: string, status: string, userId: string) {
    if (status === 'approved') {
      const { error } = await supabase.rpc('approve_grn', { target_grn_id: id, approver_id: userId })
      if (error) {
        alert(`Failed to approve stock entry: ${error.message}`)
        return
      }
    } else {
      const update: Record<string, string> = { status }
      await supabase.from('goods_received_notes').update(update).eq('id', id)
    }
    loadGRNs()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const canApprove = userProfile?.role === 'admin' || userProfile?.role === 'store_manager'

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock In — Goods Received Notes</h1>
          <p className="page-subtitle">{total} GRNs total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(grns.map(g => ({
            'GRN Number': g.grn_number,
            'Supplier': (g as any).supplier?.name,
            'Date': g.received_date,
            'Total Value': g.total_value,
            'Status': g.status,
          })), generateExportFilename('grns'))} className="btn-secondary">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} /> New GRN
          </button>
        </div>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="form-input pl-9" placeholder="Search GRN number…" />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[140px]">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>GRN Number</th>
                <th>Supplier</th>
                <th>Date Received</th>
                <th>Invoice No</th>
                <th>PO Number</th>
                <th>Received By</th>
                <th className="text-right">Total Value</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <RefreshCw size={18} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              ) : grns.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <ArrowDownToLine size={32} className="mx-auto mb-2 opacity-30" />No GRNs found
                </td></tr>
              ) : grns.map(grn => (
                <tr key={grn.id}>
                  <td><span className="font-mono text-sm font-700 text-blue-700">{grn.grn_number || 'DRAFT'}</span></td>
                  <td className="font-600 text-gray-800">{(grn as any).supplier?.name ?? '—'}</td>
                  <td className="text-gray-600">{formatDate(grn.received_date)}</td>
                  <td className="text-gray-500 text-sm">{grn.invoice_number ?? '—'}</td>
                  <td className="text-gray-500 text-sm">{grn.purchase_order_number ?? '—'}</td>
                  <td className="text-gray-600 text-sm">{(grn as any).received_by_profile?.full_name ?? '—'}</td>
                  <td className="text-right font-700 text-gray-800">{formatCurrency(grn.total_value)}</td>
                  <td><StatusBadge status={grn.status} /></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setViewGRN(grn)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View">
                        <Eye size={14} />
                      </button>
                      {grn.status === 'submitted' && canApprove && (
                        <>
                          <button onClick={() => updateStatus(grn.id, 'approved', userProfile!.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Approve & Commit Stock">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => updateStatus(grn.id, 'rejected', userProfile!.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Reject">
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      {grn.status === 'draft' && (
                        <button onClick={() => updateStatus(grn.id, 'submitted', userProfile?.id ?? '')}
                          className="p-1.5 rounded-lg text-xs font-600 text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded shadow-sm transition-colors" title="Submit for Approval">
                          Submit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 text-sm text-gray-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <GRNModal
          userProfile={userProfile}
          onClose={() => setShowModal(false)}
          onSave={() => { setShowModal(false); loadGRNs() }}
        />
      )}

      {viewGRN && (
        <GRNViewModal grn={viewGRN} onClose={() => setViewGRN(null)} />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  }
  return <span className={`badge capitalize ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function GRNModal({ userProfile, onClose, onSave }: { userProfile: Profile | null; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    supplier_id: '',
    delivery_note_number: '',
    invoice_number: '',
    purchase_order_number: '',
    received_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [lineItems, setLineItems] = useState([{ item_id: '', quantity_ordered: '', quantity_received: '', unit_cost: '', expiry_date: '', batch_number: '' }])

  useEffect(() => {
    Promise.all([
      supabase.from('suppliers').select('id,name').eq('is_active', true).order('name'),
      supabase.from('inventory_items').select('id,name,item_code,unit_cost,unit:units(abbreviation)').eq('is_active', true).order('name'),
    ]).then(([s, i]) => {
      setSuppliers((s.data ?? []) as any)
      setInventoryItems((i.data ?? []) as any)
    })
  }, [])

  function addLine() {
    setLineItems(l => [...l, { item_id: '', quantity_ordered: '', quantity_received: '', unit_cost: '', expiry_date: '', batch_number: '' }])
  }

  function removeLine(i: number) {
    setLineItems(l => l.filter((_, idx) => idx !== i))
  }

  // Refactored to fetch pricing defaults intelligently on selection changes
  function updateLine(i: number, k: string, v: string) {
    setLineItems(l => l.map((line, idx) => {
      if (idx !== i) return line
      const updated = { ...line, [k]: v }
      if (k === 'item_id') {
        const item = inventoryItems.find(it => it.id === v)
        if (item) updated.unit_cost = String(item.unit_cost ?? 0)
      }
      return updated
    }))
  }

  const totalValue = lineItems.reduce((s, l) => s + (Number(l.quantity_received || 0) * Number(l.unit_cost || 0)), 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    setSaving(true)
    setError('')
    try {
      // Temporary sequential tracking reference string generation logic
      const trackingRef = `GRN-TMP-${Math.floor(100000 + Math.random() * 900000)}`

      const { data: grn, error: grnErr } = await supabase.from('goods_received_notes').insert({
        ...form,
        received_by: userProfile.id,
        grn_number: trackingRef,
        total_value: totalValue,
        status: 'draft',
      }).select().single()
      if (grnErr) throw grnErr

      const items = lineItems.filter(l => l.item_id && l.quantity_received).map(l => ({
        grn_id: grn.id,
        item_id: l.item_id,
        quantity_ordered: l.quantity_ordered ? Number(l.quantity_ordered) : null,
        quantity_received: Number(l.quantity_received),
        unit_cost: Number(l.unit_cost),
        expiry_date: l.expiry_date || null,
        batch_number: l.batch_number || null,
      }))

      if (items.length > 0) {
        const { error: itemErr } = await supabase.from('grn_items').insert(items)
        if (itemErr) throw itemErr
      }
      onSave()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card w-full max-w-5xl flex flex-col max-h-[90vh] shadow-xl animate-in zoom-in-95">
        
        {/* Sticky Form Header Container */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="font-display font-700 text-lg text-gray-900">New Goods Received Note</h2>
            <p className="text-xs text-gray-500 mt-0.5">Logs temporary batches to draft states until committed by an administrator.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Document Field Area */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 max-h-[68vh]">
          
          {/* Metadata Section */}
          <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-600 text-gray-700 mb-1">Supplier *</label>
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} className="form-input w-full text-sm" required>
                <option value="">— Select Supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-gray-700 mb-1">Date Received *</label>
              <input type="date" value={form.received_date} onChange={e => setForm(f => ({ ...f, received_date: e.target.value }))} className="form-input w-full text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-600 text-gray-700 mb-1">Invoice Number</label>
              <input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="form-input w-full text-sm" placeholder="INV-XXXX" />
            </div>
            <div>
              <label className="block text-xs font-600 text-gray-700 mb-1">Delivery Note No.</label>
              <input value={form.delivery_note_number} onChange={e => setForm(f => ({ ...f, delivery_note_number: e.target.value }))} className="form-input w-full text-sm" />
            </div>
            <div>
              <label className="block text-xs font-600 text-gray-700 mb-1">Purchase Order No.</label>
              <input value={form.purchase_order_number} onChange={e => setForm(f => ({ ...f, purchase_order_number: e.target.value }))} className="form-input w-full text-sm" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-600 text-gray-700 mb-1">Internal Notes / Observations</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="form-input w-full text-sm" rows={2} />
            </div>
          </div>

          {/* Lines Table Layout wrapper */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-700 text-blue-600 uppercase tracking-wider">Items Received Entry Matrix</h3>
              <button type="button" onClick={addLine} className="btn-secondary text-xs py-1.5 px-3"><Plus size={13} /> Add New Row</button>
            </div>
            
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr className="bg-gray-50/70 text-xs">
                    <th className="w-1/3">Item Catalog Description</th>
                    <th className="text-right w-24">Qty Ordered</th>
                    <th className="text-right w-24">Qty Received *</th>
                    <th className="text-right w-28">Unit Cost *</th>
                    <th className="text-right w-28">Subtotal</th>
                    <th className="w-28">Batch No.</th>
                    <th className="w-36">Expiry Date</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lineItems.map((line, i) => (
                    <tr key={i} className="hover:bg-gray-50/40">
                      <td className="p-2">
                        <select value={line.item_id} onChange={e => updateLine(i, 'item_id', e.target.value)} className="form-input text-xs w-full py-1" required>
                          <option value="">— Select Catalog Item —</option>
                          {inventoryItems.map(it => <option key={it.id} value={it.id}>{it.name} {(it as any).unit?.abbreviation ? `(${(it as any).unit.abbreviation})` : ''}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={line.quantity_ordered} onChange={e => updateLine(i, 'quantity_ordered', e.target.value)} className="form-input text-xs py-1 text-right w-full" /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={line.quantity_received} onChange={e => updateLine(i, 'quantity_received', e.target.value)} className="form-input text-xs py-1 text-right w-full" required /></td>
                      <td className="p-2"><input type="number" min="0" step="0.01" value={line.unit_cost} onChange={e => updateLine(i, 'unit_cost', e.target.value)} className="form-input text-xs py-1 text-right w-full" required /></td>
                      <td className="p-2 text-right font-700 text-xs text-gray-900">{formatCurrency(Number(line.quantity_received || 0) * Number(line.unit_cost || 0))}</td>
                      <td className="p-2"><input value={line.batch_number} onChange={e => updateLine(i, 'batch_number', e.target.value)} className="form-input text-xs py-1 w-full" placeholder="Batch ref" /></td>
                      <td className="p-2"><input type="date" value={line.expiry_date} onChange={e => updateLine(i, 'expiry_date', e.target.value)} className="form-input text-xs py-1 w-full" /></td>
                      <td className="p-2 text-center">
                        {lineItems.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 transition-colors p-1"><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50 font-700 text-sm border-t border-gray-100">
                    <td colSpan={4} className="text-right py-3 px-4 text-gray-600">Total Valuation Summary:</td>
                    <td className="text-right py-3 px-4 text-blue-700 font-display">{formatCurrency(totalValue)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        </form>

        {/* Sticky Confirmation Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white rounded-b-xl flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary px-5">Cancel</button>
          <button type="submit" onClick={handleSave} disabled={saving} className="btn-primary px-5 shadow-sm">
            {saving ? 'Saving batch…' : 'Save Draft Document'}
          </button>
        </div>

      </div>
    </div>
  )
}

function GRNViewModal({ grn, onClose }: { grn: GoodsReceivedNote; onClose: () => void }) {
  const [fullGRN, setFullGRN] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('goods_received_notes')
      .select('*, supplier:suppliers(*), received_by_profile:profiles!goods_received_notes_received_by_fkey(full_name), items:grn_items(*, item:inventory_items(name, item_code, unit:units(abbreviation)))')
      .eq('id', grn.id).single()
      .then(({ data }) => setFullGRN(data))
  }, [grn.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="card w-full max-w-3xl flex flex-col max-h-[90vh] shadow-xl animate-in zoom-in-95">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="font-mono font-700 text-blue-700 text-base">{grn.grn_number || 'DRAFT UNASSIGNED'}</h2>
            <p className="text-xs text-gray-500">Inspection & audit logs</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-5 max-h-[70vh]">
          {!fullGRN ? (
            <div className="py-12 text-center text-gray-400"><RefreshCw size={20} className="inline animate-spin" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div><span className="text-gray-500 block mb-0.5">Supplier Profile</span> <span className="font-600 text-gray-900 text-sm">{fullGRN.supplier?.name}</span></div>
                <div><span className="text-gray-500 block mb-0.5">Date Processed</span> <span className="font-600 text-gray-900 text-sm">{formatDate(fullGRN.received_date)}</span></div>
                <div><span className="text-gray-500 block mb-0.5">Invoice Assignment</span> <span className="text-gray-900 font-mono">{fullGRN.invoice_number ?? '—'}</span></div>
                <div><span className="text-gray-500 block mb-0.5">PO Link Reference</span> <span className="text-gray-900 font-mono">{fullGRN.purchase_order_number ?? '—'}</span></div>
                <div><span className="text-gray-500 block mb-0.5">Officer in Charge</span> <span className="text-gray-900 text-sm">{fullGRN.received_by_profile?.full_name}</span></div>
                <div><span className="text-gray-500 block mb-0.5">Verification Status</span> <StatusBadge status={fullGRN.status} /></div>
              </div>
              
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="data-table">
                  <thead className="bg-gray-50 text-xs">
                    <tr>
                      <th>Item</th>
                      <th>Code</th>
                      <th className="text-right">Qty Received</th>
                      <th className="text-right">Unit Cost</th>
                      <th className="text-right">Total</th>
                      <th>Batch</th>
                      <th>Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullGRN.items?.map((item: any) => (
                      <tr key={item.id} className="text-xs">
                        <td className="font-600 text-gray-900">{item.item?.name}</td>
                        <td className="font-mono text-gray-500">{item.item?.item_code}</td>
                        <td className="text-right font-600 text-gray-800">{item.quantity_received} {item.item?.unit?.abbreviation}</td>
                        <td className="text-right text-gray-600">{formatCurrency(item.unit_cost)}</td>
                        <td className="text-right font-700 text-gray-900">{formatCurrency(item.quantity_received * item.unit_cost)}</td>
                        <td className="text-gray-500 font-mono">{item.batch_number ?? '—'}</td>
                        <td className="text-gray-500">{item.expiry_date ? formatDate(item.expiry_date) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 font-700 text-sm border-t border-gray-100">
                      <td colSpan={4} className="text-right py-3 px-4 text-gray-700">Grand Total Valuation:</td>
                      <td className="text-right py-3 px-4 text-blue-700">{formatCurrency(fullGRN.total_value)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {fullGRN.notes && (
                <div className="p-3 rounded-lg bg-gray-50 text-xs text-gray-600 border border-gray-100">
                  <strong className="block mb-1 text-gray-700">Remarks:</strong>
                  {fullGRN.notes}
                </div>
              )}
            </>
          )}
        </div>
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end rounded-b-xl flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary text-xs px-4">Close View</button>
        </div>
      </div>
    </div>
  )
}
