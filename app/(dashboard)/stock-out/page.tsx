'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, exportToCSV, generateExportFilename } from '@/lib/utils'
import {
  Plus, Search, Download, Eye, CheckCircle, XCircle, Send,
  X, Trash2, ChevronLeft, ChevronRight, RefreshCw, ArrowUpFromLine
} from 'lucide-react'
import type { IssueVoucher, Department, InventoryItem, Profile } from '@/types'

const PAGE_SIZE = 15

export default function StockOutPage() {
  const [vouchers, setVouchers] = useState<IssueVoucher[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [viewVoucher, setViewVoucher] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setUserProfile(data)
      }
    })
    supabase.from('departments').select('*').eq('is_active', true).order('name').then(({ data }) => setDepartments(data ?? []))
  }, [])

  useEffect(() => { loadVouchers() }, [page, search, statusFilter, deptFilter])

  async function loadVouchers() {
    setLoading(true)
    let q = supabase
      .from('issue_vouchers')
      .select(`
        *, 
        department:departments(id,name), 
        requested_by_profile:profiles!issue_vouchers_requested_by_fkey(id,full_name),
        items:issue_voucher_items(
          item:inventory_items(name)
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) q = q.ilike('voucher_number', `%${search}%`)
    if (statusFilter) q = q.eq('status', statusFilter)
    if (deptFilter) q = q.eq('department_id', deptFilter)

    const { data, count } = await q
    setVouchers(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  async function updateStatus(id: string, status: string) {
    if (!userProfile) return
    try {
      if (status === 'issued') {
        // All stock deductions are now handled by the database function
        const { error } = await supabase.rpc(
          'approve_issue_voucher',
          {
            target_voucher_id: id,
            issuer_id: userProfile.id,
          }
        )
        if (error) throw error
      }
      else if (status === 'approved') {
        // Copy requested quantities into approved quantities
        const { data: voucherItems, error: fetchErr } = await supabase
          .from('issue_voucher_items')
          .select('id, quantity_requested')
          .eq('voucher_id', id)

        if (fetchErr) throw fetchErr

        for (const item of voucherItems ?? []) {
          const { error: lineErr } = await supabase
            .from('issue_voucher_items')
            .update({
              quantity_approved: item.quantity_requested
            })
            .eq('id', item.id)

          if (lineErr) throw lineErr
        }

        const { error: updateErr } = await supabase
          .from('issue_vouchers')
          .update({
            status: 'approved',
            approved_by: userProfile.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (updateErr) throw updateErr
      }
      else {
        const { error: updateErr } = await supabase
          .from('issue_vouchers')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (updateErr) throw updateErr
      }

      await loadVouchers()
    } catch (err: any) {
      console.error('Error executing stock out workflow:', err)
      alert(
        `Transaction Halted: ${
          err.message || 'Please check schema configurations.'
        }`
      )
    }
  }

  const canApprove = userProfile?.role === 'admin' || userProfile?.role === 'store_manager'
  const canIssue = userProfile?.role === 'admin' || userProfile?.role === 'store_manager' || userProfile?.role === 'store_officer'
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stock Out — Issue Vouchers</h1>
          <p className="page-subtitle">{total} vouchers total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(vouchers.map(v => ({
            'Voucher Number': v.voucher_number,
            'Department': (v as any).department?.name,
            'Date': v.request_date,
            'Total Value': v.total_value,
            'Status': v.status,
          })), generateExportFilename('vouchers'))} className="btn-secondary">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus size={15} /> New Voucher
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="form-input pl-9" placeholder="Search voucher…" />
        </div>
        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[160px]">
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[140px]">
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="approved">Approved</option>
          <option value="issued">Issued</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Voucher No.</th>
                <th>Department</th>
                <th>Requested By</th>
                <th>Request Date</th>
                <th>Items Requested</th>
                <th>Purpose</th>
                <th className="text-right">Total Value</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400"><RefreshCw size={18} className="inline animate-spin mr-2" />Loading…</td></tr>
              ) : vouchers.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400"><ArrowUpFromLine size={32} className="mx-auto mb-2 opacity-30" />No vouchers found</td></tr>
              ) : vouchers.map(v => {
                const itemsList = (v as any).items
                  ?.map((line: any) => line.item?.name)
                  .filter(Boolean)
                  .join(', ')

                return (
                  <tr key={v.id}>
                    <td><span className="font-mono text-sm font-700 text-amber-700">{v.voucher_number}</span></td>
                    <td className="font-600 text-gray-800">{(v as any).department?.name ?? '—'}</td>
                    <td className="text-gray-600 text-sm">{(v as any).requested_by_profile?.full_name ?? '—'}</td>
                    <td className="text-gray-600">{formatDate(v.request_date)}</td>
                    <td className="text-gray-700 text-sm max-w-[200px] truncate font-500" title={itemsList}>
                      {itemsList || '—'}
                    </td>
                    <td className="text-gray-500 text-sm max-w-[160px] truncate">{v.purpose ?? '—'}</td>
                    <td className="text-right font-700 text-gray-800">{formatCurrency(v.total_value)}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setViewVoucher(v)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="View"><Eye size={14} /></button>
                        {v.status === 'draft' && (
                          <button onClick={() => updateStatus(v.id, 'submitted')} className="px-2 py-1 rounded text-xs text-white bg-blue-500 hover:bg-blue-600 transition-colors">Submit</button>
                        )}
                        {v.status === 'submitted' && canApprove && (
                          <>
                            <button onClick={() => updateStatus(v.id, 'approved')} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors" title="Approve"><CheckCircle size={14} /></button>
                            <button onClick={() => updateStatus(v.id, 'rejected')} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Reject"><XCircle size={14} /></button>
                          </>
                        )}
                        {v.status === 'approved' && canIssue && (
                          <button onClick={() => updateStatus(v.id, 'issued')} className="px-2 py-1 rounded text-xs text-white bg-purple-600 hover:bg-purple-700 transition-colors flex items-center gap-1"><Send size={11} /> Issue</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
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

      {showModal && <VoucherModal userProfile={userProfile} departments={departments} onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadVouchers() }} />}
      {viewVoucher && <VoucherViewModal voucher={viewVoucher} onClose={() => setViewVoucher(null)} />}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    issued: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return <span className={`badge ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>{status}</span>
}

function VoucherModal({ userProfile, departments, onClose, onSave }: any) {
  const supabase = createClient()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ department_id: '', request_date: new Date().toISOString().split('T')[0], purpose: '', notes: '' })
  const [lines, setLines] = useState([{ item_id: '', quantity_requested: '', notes: '' }])

  useEffect(() => {
    supabase.from('inventory_items').select('id,name,item_code,unit_cost,quantity_in_stock,unit:units(abbreviation)').eq('is_active', true).gt('quantity_in_stock', 0).order('name').then(({ data }) => setItems((data ?? []) as any))
  }, [])

  function addLine() { setLines(l => [...l, { item_id: '', quantity_requested: '', notes: '' }]) }
  function removeLine(i: number) { setLines(l => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, k: string, v: string) { setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [k]: v } : ln)) }

  const totalValue = lines.reduce((s, l) => {
    const item = items.find(i => i.id === l.item_id)
    return s + (Number(l.quantity_requested) * (item?.unit_cost ?? 0))
  }, 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userProfile) return
    setSaving(true)
    setError('')
    try {
      const { data: voucher, error: vErr } = await supabase.from('issue_vouchers').insert({
        ...form,
        requested_by: userProfile.id,
        voucher_number: '',
        total_value: totalValue,
        status: 'draft',
      }).select().single()
      if (vErr) throw vErr

      const vItems = lines.filter(l => l.item_id && l.quantity_requested).map(l => ({
        voucher_id: voucher.id,
        item_id: l.item_id,
        quantity_requested: Number(l.quantity_requested),
        unit_cost: items.find(i => i.id === l.item_id)?.unit_cost ?? 0,
        notes: l.notes || null,
      }))
      if (vItems.length > 0) {
        const { error: iErr } = await supabase.from('issue_voucher_items').insert(vItems)
        if (iErr) throw iErr
      }
      onSave()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-display font-700 text-xl text-gray-900">New Issue Voucher</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Department *</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))} className="form-input" required>
                <option value="">— Select Department —</option>
                {departments.map((d: Department) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Request Date *</label>
              <input type="date" value={form.request_date} onChange={e => setForm(f => ({ ...f, request_date: e.target.value }))} className="form-input" required />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Purpose</label>
              <input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className="form-input" placeholder="Reason for requisition" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="form-input" rows={2} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-700 text-gray-900">Items Requested</h3>
              <button type="button" onClick={addLine} className="btn-secondary text-sm py-1.5"><Plus size={14} /> Add Line</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Available</th>
                    <th className="text-right">Qty Requested *</th>
                    <th className="text-right">Unit Cost</th>
                    <th className="text-right">Total</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const item = items.find(it => it.id === line.item_id)
                    return (
                      <tr key={i}>
                        <td>
                          <select value={line.item_id} onChange={e => updateLine(i, 'item_id', e.target.value)} className="form-input text-sm py-1.5 min-w-[200px]" required>
                            <option value="">— Select Item —</option>
                            {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                          </select>
                        </td>
                        <td className="text-right text-sm text-gray-500">{item ? `${item.quantity_in_stock} ${(item as any).unit?.abbreviation ?? ''}` : '—'}</td>
                        <td><input type="number" min="0" step="0.01" max={item?.quantity_in_stock} value={line.quantity_requested} onChange={e => updateLine(i, 'quantity_requested', e.target.value)} className="form-input text-sm py-1.5 w-24 text-right" required /></td>
                        <td className="text-right text-sm text-gray-600">{item ? formatCurrency(item.unit_cost) : '—'}</td>
                        <td className="text-right font-700 text-sm">{formatCurrency(Number(line.quantity_requested) * (item?.unit_cost ?? 0))}</td>
                        <td><input value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)} className="form-input text-sm py-1.5 w-32" /></td>
                        <td>{lines.length > 1 && <button type="button" onClick={() => removeLine(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="text-right font-700 text-gray-700 py-3 px-4">Estimated Total:</td>
                    <td className="text-right font-700 text-gray-900 py-3 px-4">{formatCurrency(totalValue)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Voucher'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function VoucherViewModal({ voucher, onClose }: { voucher: any; onClose: () => void }) {
  const [full, setFull] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('issue_vouchers')
      .select('*, department:departments(name), requested_by_profile:profiles!issue_vouchers_requested_by_fkey(full_name), approved_by_profile:profiles!issue_vouchers_approved_by_fkey(full_name), issued_by_profile:profiles!issue_vouchers_issued_by_fkey(full_name), items:issue_voucher_items(*, item:inventory_items(name, item_code, unit:units(abbreviation)))')
      .eq('id', voucher.id).single()
      .then(({ data }) => setFull(data))
  }, [voucher.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-700 text-xl text-gray-900">{voucher.voucher_number}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        {!full ? (
          <div className="p-12 text-center text-gray-400"><RefreshCw size={20} className="inline animate-spin" /></div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Department:</span> <span className="font-600 ml-1">{full.department?.name}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className="ml-1"><StatusBadge status={full.status} /></span></div>
              <div><span className="text-gray-500">Requested By:</span> <span className="ml-1">{full.requested_by_profile?.full_name}</span></div>
              <div><span className="text-gray-500">Request Date:</span> <span className="ml-1">{formatDate(full.request_date)}</span></div>
              {full.approved_by_profile && <div><span className="text-gray-500">Approved By:</span> <span className="ml-1">{full.approved_by_profile.full_name}</span></div>}
              {full.issued_by_profile && <div><span className="text-gray-500">Issued By:</span> <span className="ml-1">{full.issued_by_profile.full_name}</span></div>}
              {full.purpose && <div className="col-span-2"><span className="text-gray-500">Purpose:</span> <span className="ml-1">{full.purpose}</span></div>}
            </div>
            <table className="data-table border border-gray-100 rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Requested</th>
                  <th className="text-right">Approved</th>
                  <th className="text-right">Issued</th>
                  <th className="text-right">Unit Cost</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {full.items?.map((item: any) => (
                  <tr key={item.id}>
                    <td className="font-600">{item.item?.name} <span className="text-xs font-normal text-gray-400 ml-1">{item.item?.item_code}</span></td>
                    <td className="text-right">{item.quantity_requested} {item.item?.unit?.abbreviation}</td>
                    <td className="text-right">{item.quantity_approved ?? '—'}</td>
                    <td className="text-right">{item.quantity_issued ?? '—'}</td>
                    <td className="text-right">{formatCurrency(item.unit_cost)}</td>
                    <td className="text-right font-700">{formatCurrency(item.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right font-700 text-gray-700 py-3 px-4">Grand Total:</td>
                  <td className="text-right font-700 text-gray-900 py-3 px-4">{formatCurrency(full.total_value)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
