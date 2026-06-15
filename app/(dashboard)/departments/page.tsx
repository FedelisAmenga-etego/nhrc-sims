'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Edit2, Trash2, X, Building2, Download } from 'lucide-react'
import { exportToCSV, generateExportFilename } from '@/lib/utils'
import type { Department } from '@/types'

export default function DepartmentsPage() {
  const [depts, setDepts] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editDept, setEditDept] = useState<Department | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [search])

  async function load() {
    setLoading(true)
    let q = supabase.from('departments').select('*').order('name')
    if (search) q = q.ilike('name', `%${search}%`)
    const { data } = await q
    setDepts(data ?? [])
    setLoading(false)
  }

  async function toggleActive(dept: Department) {
    await supabase.from('departments').update({ is_active: !dept.is_active }).eq('id', dept.id)
    load()
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">{depts.filter(d => d.is_active).length} active departments</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(depts.map(d => ({ Name: d.name, Code: d.code, Head: d.head_of_department ?? '', Phone: d.phone ?? '', Email: d.email ?? '', Location: d.location ?? '', Active: d.is_active ? 'Yes' : 'No' })), generateExportFilename('departments'))} className="btn-secondary"><Download size={15} /> Export</button>
          <button onClick={() => { setEditDept(null); setShowModal(true) }} className="btn-primary"><Plus size={15} /> Add Department</button>
        </div>
      </div>

      <div className="card p-4 mb-5">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search departments…" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Department Name</th>
                <th>Code</th>
                <th>Head of Department</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Location</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : depts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400"><Building2 size={32} className="mx-auto mb-2 opacity-30" />No departments found</td></tr>
              ) : depts.map(d => (
                <tr key={d.id}>
                  <td className="font-700 text-gray-900">{d.name}</td>
                  <td><code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{d.code}</code></td>
                  <td className="text-gray-600">{d.head_of_department ?? '—'}</td>
                  <td className="text-gray-600">{d.phone ?? '—'}</td>
                  <td className="text-gray-600 text-sm">{d.email ?? '—'}</td>
                  <td className="text-gray-500 text-sm">{d.location ?? '—'}</td>
                  <td>
                    <span className={`badge ${d.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditDept(d); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => toggleActive(d)} className={`p-1.5 rounded-lg transition-colors text-gray-400 ${d.is_active ? 'hover:text-red-600 hover:bg-red-50' : 'hover:text-green-600 hover:bg-green-50'}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <DeptModal dept={editDept} onClose={() => { setShowModal(false); setEditDept(null) }} onSave={() => { setShowModal(false); setEditDept(null); load() }} />}
    </div>
  )
}

function DeptModal({ dept, onClose, onSave }: { dept: Department | null; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: dept?.name ?? '',
    code: dept?.code ?? '',
    head_of_department: dept?.head_of_department ?? '',
    phone: dept?.phone ?? '',
    email: dept?.email ?? '',
    location: dept?.location ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (dept) {
        const { error: err } = await supabase.from('departments').update(form).eq('id', dept.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('departments').insert(form)
        if (err) throw err
      }
      onSave()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-700 text-xl text-gray-900">{dept ? 'Edit Department' : 'Add Department'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-600 text-gray-700 mb-1.5">Department Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} className="form-input" required /></div>
            <div><label className="block text-sm font-600 text-gray-700 mb-1.5">Code *</label><input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} className="form-input font-mono" placeholder="e.g. LAB" required /></div>
            <div><label className="block text-sm font-600 text-gray-700 mb-1.5">Location</label><input value={form.location} onChange={e => set('location', e.target.value)} className="form-input" /></div>
            <div className="col-span-2"><label className="block text-sm font-600 text-gray-700 mb-1.5">Head of Department</label><input value={form.head_of_department} onChange={e => set('head_of_department', e.target.value)} className="form-input" /></div>
            <div><label className="block text-sm font-600 text-gray-700 mb-1.5">Phone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} className="form-input" /></div>
            <div><label className="block text-sm font-600 text-gray-700 mb-1.5">Email</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="form-input" /></div>
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : dept ? 'Update' : 'Add Department'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
