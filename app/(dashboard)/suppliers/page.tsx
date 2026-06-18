'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Edit2, Trash2, X, Truck, Download } from 'lucide-react'
import { exportToCSV, generateExportFilename } from '@/lib/utils'
import type { Supplier } from '@/types'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [search])

  async function load() {
    setLoading(true)
    let q = supabase.from('suppliers').select('*').eq('is_active', true).order('name')
    if (search) q = q.ilike('name', `%${search}%`)
    const { data } = await q
    setSuppliers(data ?? [])
    setLoading(false)
  }

  async function deactivate(id: string) {
    await supabase.from('suppliers').update({ is_active: false }).eq('id', id)
    load()
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">{suppliers.length} active suppliers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(suppliers.map(s => ({ Name: s.name, Contact: s.contact_person ?? '', Phone: s.phone ?? '', Email: s.email ?? '', Address: s.address ?? '', TIN: s.tin_number ?? '' })), generateExportFilename('suppliers'))} className="btn-secondary"><Download size={15} /> Export</button>
          <button onClick={() => { setEditSupplier(null); setShowModal(true) }} className="btn-primary"><Plus size={15} /> Add Supplier</button>
        </div>
      </div>

      <div className="card p-4 mb-5">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search suppliers…" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Supplier Name</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>Email</th>
                <th>TIN</th>
                <th>Bank</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><Truck size={32} className="mx-auto mb-2 opacity-30" />No suppliers found</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id}>
                  <td className="font-700 text-gray-900">{s.name}</td>
                  <td className="text-gray-600">{s.contact_person ?? '—'}</td>
                  <td className="text-gray-600">{s.phone ?? '—'}</td>
                  <td className="text-gray-600 text-sm">{s.email ?? '—'}</td>
                  <td className="text-gray-500 text-sm">{s.tin_number ?? '—'}</td>
                  <td className="text-gray-500 text-sm">{s.bank_name ?? '—'}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditSupplier(s); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => deactivate(s.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <SupplierModal supplier={editSupplier} onClose={() => { setShowModal(false); setEditSupplier(null) }} onSave={() => { setShowModal(false); setEditSupplier(null); load() }} />}
    </div>
  )
}

function SupplierModal({ supplier, onClose, onSave }: { supplier: Supplier | null; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: supplier?.name ?? '',
    contact_person: supplier?.contact_person ?? '',
    email: supplier?.email ?? '',
    phone: supplier?.phone ?? '',
    address: supplier?.address ?? '',
    tin_number: supplier?.tin_number ?? '',
    bank_name: supplier?.bank_name ?? '',
    bank_account: supplier?.bank_account ?? '',
    notes: supplier?.notes ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (supplier) {
        const { error: err } = await supabase.from('suppliers').update(form).eq('id', supplier.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('suppliers').insert(form)
        if (err) throw err
      }
      onSave()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      {/* Container with a defined layout flow to prevent truncation */}
      <div className="card w-full max-w-2xl flex flex-col max-h-[90vh] shadow-xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white rounded-t-xl flex-shrink-0">
          <div>
            <h2 className="font-display font-700 text-lg text-gray-900">
              {supplier ? 'Edit Supplier Details' : 'Register New Supplier'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill out information below to manage procurement profiles.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        {/* Scrollable Form Body with clean semantic sectioning */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[65vh] bg-gray-50/50">
          
          {/* Section 1: Basic Info */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-700 text-blue-600 uppercase tracking-wider">Primary Identity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-gray-700 mb-1">Supplier Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} className="form-input w-full" placeholder="e.g. Enterprise Logistics Ltd" required />
              </div>
            </div>
          </div>

          {/* Section 2: Contact & Location */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-700 text-blue-600 uppercase tracking-wider">Contact & Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-600 text-gray-700 mb-1">Contact Person</label>
                <input value={form.contact_person} onChange={e => set('contact_person', e.target.value)} className="form-input w-full" placeholder="Full Name" />
              </div>
              <div>
                <label className="block text-xs font-600 text-gray-700 mb-1">Phone Number</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} className="form-input w-full" placeholder="e.g. +233..." />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-gray-700 mb-1">Email Address</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="form-input w-full" placeholder="supplier@example.com" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-gray-700 mb-1">Physical Address</label>
                <textarea value={form.address} onChange={e => set('address', e.target.value)} className="form-input w-full" rows={2} placeholder="Street name, City, Region" />
              </div>
            </div>
          </div>

          {/* Section 3: Financials & Notes */}
          <div className="space-y-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-xs font-700 text-blue-600 uppercase tracking-wider">Financials & Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-600 text-gray-700 mb-1">TIN Number</label>
                <input value={form.tin_number} onChange={e => set('tin_number', e.target.value)} className="form-input w-full" placeholder="Tax Identification Number" />
              </div>
              <div>
                <label className="block text-xs font-600 text-gray-700 mb-1">Bank Name</label>
                <input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} className="form-input w-full" placeholder="e.g. GCB Bank" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-gray-700 mb-1">Bank Account Number</label>
                <input value={form.bank_account} onChange={e => set('bank_account', e.target.value)} className="form-input w-full" placeholder="Account Number" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-600 text-gray-700 mb-1">Internal Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="form-input w-full" rows={2} placeholder="Delivery schedules, alternative terms, etc." />
              </div>
            </div>
          </div>

          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        </form>

        {/* Sticky Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white rounded-b-xl flex-shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary px-5">Cancel</button>
          <button type="submit" onClick={handleSave} disabled={saving} className="btn-primary px-5 shadow-sm">
            {saving ? 'Saving…' : supplier ? 'Update Profile' : 'Save Supplier'}
          </button>
        </div>

      </div>
    </div>
  )
}
