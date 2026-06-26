'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Edit2, Users, X, Download } from 'lucide-react'
import { getRoleLabel, getRoleColor, exportToCSV, generateExportFilename } from '@/lib/utils'
import type { Profile, Department } from '@/types'

export default function StaffPage() {
  const [staff, setStaff] = useState<Profile[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editStaff, setEditStaff] = useState<Profile | null>(null)
  const supabase = createClient()

  useEffect(() => { load(); loadDepts() }, [search, roleFilter])

  async function load() {
    setLoading(true)
    let q = supabase.from('profiles').select('*, department:departments(name)').order('full_name')
    if (search) q = q.ilike('full_name', `%${search}%`)
    if (roleFilter) q = q.eq('role', roleFilter)
    const { data } = await q
    setStaff(data ?? [])
    setLoading(false)
  }

  async function loadDepts() {
    const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('name')
    setDepartments(data ?? [])
  }

  async function toggleActive(profile: Profile) {
    await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id)
    load()
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff & Users</h1>
          <p className="page-subtitle">{staff.filter(s => s.is_active).length} active users</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(staff.map(s => ({ Name: s.full_name, Email: s.email, Role: getRoleLabel(s.role), 'Employee ID': s.employee_id ?? '', Department: (s as any).department?.name ?? '', Active: s.is_active ? 'Yes' : 'No' })), generateExportFilename('staff'))} className="btn-secondary"><Download size={15} /> Export</button>
          <button onClick={() => { setEditStaff(null); setShowModal(true) }} className="btn-primary"><Plus size={15} /> Add User</button>
        </div>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search staff…" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="form-input w-auto min-w-[160px]">
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="store_manager">Store Manager</option>
          <option value="store_officer">Store Officer</option>
          <option value="viewer">Viewer</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Phone</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : staff.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400"><Users size={32} className="mx-auto mb-2 opacity-30" />No staff found</td></tr>
              ) : staff.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #1a3a6b, #c8963e)' }}>
                        {s.full_name ? s.full_name.charAt(0) : 'U'}
                      </div>
                      <span className="font-600 text-gray-900">{s.full_name ?? 'Unnamed User'}</span>
                    </div>
                  </td>
                  <td><code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{s.employee_id ?? '—'}</code></td>
                  <td className="text-gray-600 text-sm">{s.email}</td>
                  <td><span className={`badge ${getRoleColor(s.role)}`}>{getRoleLabel(s.role)}</span></td>
                  <td className="text-gray-600 text-sm">{(s as any).department?.name ?? '—'}</td>
                  <td className="text-gray-500 text-sm">{s.phone ?? '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditStaff(s); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => toggleActive(s)} className={`px-2 py-1 rounded text-xs font-600 transition-colors ${s.is_active ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}>{s.is_active ? 'Deactivate' : 'Activate'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && <StaffModal staff={editStaff} departments={departments} onClose={() => { setShowModal(false); setEditStaff(null) }} onSave={() => { setShowModal(false); setEditStaff(null); load() }} />}
    </div>
  )
}

function StaffModal({ staff, departments, onClose, onSave }: { staff: Profile | null; departments: Department[]; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: staff?.full_name ?? '',
    email: staff?.email ?? '',
    role: staff?.role ?? 'viewer',
    department_id: staff?.department_id ?? '',
    phone: staff?.phone ?? '',
    employee_id: staff?.employee_id ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (staff) {
        // Mode A: Update existing profile record safely
        const { error: err } = await supabase.from('profiles').update({
          full_name: form.full_name,
          role: form.role,
          department_id: form.department_id || null,
          phone: form.phone || null,
          employee_id: form.employee_id || null,
        }).eq('id', staff.id)
        if (err) throw err
      } else {
        // Mode B: Insert direct personnel track row into profile table
        // This registers them in your operational view directly
        const uuid = crypto.randomUUID()
        const { error: insertErr } = await supabase.from('profiles').insert([{
          id: uuid,
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          department_id: form.department_id || null,
          phone: form.phone || null,
          employee_id: form.employee_id || null,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        
        if (insertErr) throw insertErr
      }
      onSave()
    } catch (err: any) { 
      setError(err.message) 
    } finally { 
      setSaving(false) 
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white shadow-xl rounded-xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-700 text-xl text-gray-900">{staff ? 'Edit User' : 'Add New User'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Full Name *</label>
              <input value={form.full_name} onChange={e => set('full_name', e.target.value)} className="form-input" required />
            </div>
            
            {!staff && (
              <div className="col-span-2">
                <label className="block text-sm font-600 text-gray-700 mb-1.5">Email Address *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="form-input" required />
                <p className="text-[11px] text-gray-400 mt-1">Personnel details will sync automatically with your operational profiles matrix.</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Role *</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="form-input" required>
                <option value="viewer">Viewer</option>
                <option value="store_officer">Store Officer</option>
                <option value="store_manager">Store Manager</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Department</label>
              <select value={form.department_id} onChange={e => set('department_id', e.target.value)} className="form-input">
                <option value="">— None —</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Employee ID</label>
              <input value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className="form-input" placeholder="e.g. NHRC-2026" />
            </div>
            
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Phone Number</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} className="form-input" placeholder="e.g. +233..." />
            </div>
          </div>
          
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
          
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : staff ? 'Update User' : 'Add User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
