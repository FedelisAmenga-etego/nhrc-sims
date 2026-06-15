'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, User, Lock, Database, Bell, Plus, Edit2, Trash2, X, CheckCircle } from 'lucide-react'
import type { Profile, Unit } from '@/types'
import { getRoleLabel } from '@/lib/utils'

type SettingsTab = 'profile' | 'password' | 'units' | 'system'

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('profile')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setProfile(data)
      }
    })
  }, [])

  const tabs = [
    { key: 'profile' as SettingsTab, label: 'My Profile', icon: <User size={15} /> },
    { key: 'password' as SettingsTab, label: 'Password', icon: <Lock size={15} /> },
    { key: 'units' as SettingsTab, label: 'Units of Measure', icon: <Database size={15} /> },
    { key: 'system' as SettingsTab, label: 'System Info', icon: <Bell size={15} /> },
  ]

  function showSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3500)
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account and system preferences</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 text-green-700 text-sm border border-green-200 mb-5">
          <CheckCircle size={16} className="flex-shrink-0" /> {success}
        </div>
      )}

      <div className="flex gap-6 flex-col lg:flex-row">
        {/* Sidebar nav */}
        <div className="lg:w-52 flex-shrink-0">
          <nav className="card p-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-all ${
                  tab === t.key
                    ? 'bg-amber-50 text-amber-700 font-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {tab === 'profile' && profile && (
            <ProfileTab profile={profile} onSaved={() => showSuccess('Profile updated successfully!')} />
          )}
          {tab === 'password' && (
            <PasswordTab onSaved={() => showSuccess('Password changed successfully!')} />
          )}
          {tab === 'units' && (
            <UnitsTab onSaved={() => showSuccess('Units saved!')} />
          )}
          {tab === 'system' && (
            <SystemInfoTab />
          )}
        </div>
      </div>
    </div>
  )
}

function ProfileTab({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: profile.full_name,
    phone: profile.phone ?? '',
    employee_id: profile.employee_id ?? '',
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { error: err } = await supabase.from('profiles').update(form).eq('id', profile.id)
    setSaving(false)
    if (err) setError(err.message)
    else onSaved()
  }

  return (
    <div className="card p-6">
      <h2 className="font-display font-700 text-xl text-gray-900 mb-5">My Profile</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-700"
          style={{ background: 'linear-gradient(135deg, #1a3a6b, #c8963e)' }}>
          {profile.full_name.charAt(0)}
        </div>
        <div>
          <div className="font-700 text-gray-900 text-lg">{profile.full_name}</div>
          <div className="text-gray-500 text-sm">{profile.email}</div>
          <span className="badge bg-blue-50 text-blue-700 border-blue-200 mt-1">{getRoleLabel(profile.role)}</span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">Full Name *</label>
          <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="form-input" required />
        </div>
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">Email</label>
          <input value={profile.email} disabled className="form-input bg-gray-50 text-gray-400 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact your admin.</p>
        </div>
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">Phone</label>
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="form-input" placeholder="+233 XX XXX XXXX" />
        </div>
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">Employee ID</label>
          <input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} className="form-input" />
        </div>
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">
          <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function PasswordTab({ onSaved }: { onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ current: '', newPw: '', confirm: '' })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (form.newPw !== form.confirm) { setError('New passwords do not match.'); return }
    if (form.newPw.length < 6) { setError('Password must be at least 6 characters.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password: form.newPw })
    setSaving(false)
    if (err) setError(err.message)
    else { setForm({ current: '', newPw: '', confirm: '' }); onSaved() }
  }

  return (
    <div className="card p-6">
      <h2 className="font-display font-700 text-xl text-gray-900 mb-5">Change Password</h2>
      <form onSubmit={handleSave} className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">New Password *</label>
          <input type="password" value={form.newPw} onChange={e => setForm(f => ({ ...f, newPw: e.target.value }))} className="form-input" required minLength={6} />
        </div>
        <div>
          <label className="block text-sm font-600 text-gray-700 mb-1.5">Confirm New Password *</label>
          <input type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} className="form-input" required />
        </div>
        <div className="p-3 rounded-lg bg-blue-50 text-blue-700 text-xs border border-blue-100">
          Password must be at least 6 characters. You will stay logged in after changing.
        </div>
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
        <button type="submit" disabled={saving} className="btn-primary">
          <Lock size={15} /> {saving ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}

function UnitsTab({ onSaved }: { onSaved: () => void }) {
  const supabase = createClient()
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editUnit, setEditUnit] = useState<Unit | null>(null)

  useEffect(() => { loadUnits() }, [])

  async function loadUnits() {
    setLoading(true)
    const { data } = await supabase.from('units').select('*').order('name')
    setUnits(data ?? [])
    setLoading(false)
  }

  async function deleteUnit(id: string) {
    await supabase.from('units').delete().eq('id', id)
    loadUnits()
    onSaved()
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-700 text-xl text-gray-900">Units of Measure</h2>
        <button onClick={() => { setEditUnit(null); setShowModal(true) }} className="btn-primary text-sm py-2">
          <Plus size={14} /> Add Unit
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {units.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50">
              <div>
                <div className="font-600 text-gray-800 text-sm">{u.name}</div>
                <code className="text-xs text-gray-400">{u.abbreviation}</code>
              </div>
              <div className="flex gap-1">
                <button onClick={() => { setEditUnit(u); setShowModal(true) }} className="p-1 rounded text-gray-400 hover:text-blue-600"><Edit2 size={13} /></button>
                <button onClick={() => deleteUnit(u.id)} className="p-1 rounded text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <UnitModal unit={editUnit} onClose={() => { setShowModal(false); setEditUnit(null) }} onSave={() => { setShowModal(false); setEditUnit(null); loadUnits(); onSaved() }} />
      )}
    </div>
  )
}

function UnitModal({ unit, onClose, onSave }: { unit: Unit | null; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: unit?.name ?? '', abbreviation: unit?.abbreviation ?? '' })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (unit) {
        const { error: err } = await supabase.from('units').update(form).eq('id', unit.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('units').insert(form)
        if (err) throw err
      }
      onSave()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-700 text-lg text-gray-900">{unit ? 'Edit Unit' : 'Add Unit'}</h3>
          <button onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-600 text-gray-700 mb-1.5">Unit Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="e.g. Kilograms" required />
          </div>
          <div>
            <label className="block text-sm font-600 text-gray-700 mb-1.5">Abbreviation *</label>
            <input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} className="form-input" placeholder="e.g. kg" required />
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SystemInfoTab() {
  return (
    <div className="card p-6 space-y-6">
      <h2 className="font-display font-700 text-xl text-gray-900">System Information</h2>

      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { label: 'System Name', value: 'NHRC Stores Management Information System' },
          { label: 'Version', value: '1.0.0' },
          { label: 'Organisation', value: 'Navrongo Health Research Centre' },
          { label: 'Location', value: 'Navrongo, Upper East Region, Ghana' },
          { label: 'Database', value: 'Supabase (PostgreSQL)' },
          { label: 'Framework', value: 'Next.js 15 (App Router)' },
          { label: 'Hosting', value: 'Vercel' },
          { label: 'Build Year', value: '2025' },
        ].map(item => (
          <div key={item.label} className="p-4 rounded-xl border border-gray-100 bg-gray-50/40">
            <div className="text-xs text-gray-400 font-display uppercase tracking-wide mb-1">{item.label}</div>
            <div className="font-600 text-gray-800 text-sm">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50">
        <h3 className="font-display font-700 text-blue-900 mb-2">Role Permissions Summary</h3>
        <div className="space-y-2">
          {[
            { role: 'Administrator', perms: 'Full access: manage users, approve GRNs, issue vouchers, adjust stock, view all reports' },
            { role: 'Store Manager', perms: 'Approve GRNs & vouchers, manage inventory, suppliers, departments, view reports' },
            { role: 'Store Officer', perms: 'Create GRNs & vouchers, update inventory, view reports' },
            { role: 'Viewer', perms: 'Read-only access to inventory, GRNs, vouchers, and reports' },
          ].map(r => (
            <div key={r.role} className="text-sm">
              <span className="font-700 text-blue-800">{r.role}:</span>
              <span className="text-blue-700 ml-1">{r.perms}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-amber-100 bg-amber-50">
        <h3 className="font-display font-700 text-amber-900 mb-2">Setup Checklist</h3>
        <ul className="space-y-1.5 text-sm text-amber-800">
          {[
            'Run supabase-schema.sql in Supabase SQL Editor',
            'Set NEXT_PUBLIC_SUPABASE_URL in Vercel environment variables',
            'Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel environment variables',
            'Set SUPABASE_SERVICE_ROLE_KEY in Vercel environment variables',
            'Create first admin user via Supabase Auth dashboard',
            'Update that user\'s role to "admin" in the profiles table',
            'Add departments, categories, suppliers and inventory items',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-700">{i + 1}</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
