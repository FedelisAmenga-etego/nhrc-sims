'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Edit2, Trash2, X, Layers } from 'lucide-react'
import type { Category } from '@/types'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [search])

  async function load() {
    setLoading(true)
    // FIX: Removed the hardcoded foreign key mapping string to clear the 400 bad request error
    let q = supabase.from('categories').select('*, parent:categories(id, name)').order('name')
    if (search) q = q.ilike('name', `%${search}%`)
    const { data } = await q
    setCategories(data ?? [])
    setLoading(false)
  }

  async function deleteCategory(id: string) {
    await supabase.from('categories').delete().eq('id', id)
    load()
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-subtitle">Organize inventory items by category</p>
        </div>
        <button onClick={() => { setEditCat(null); setShowModal(true) }} className="btn-primary">
          <Plus size={15} /> Add Category
        </button>
      </div>

      <div className="card p-4 mb-5">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Search categories…" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Parent Category</th>
                <th>Description</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Loading…</td></tr>
              ) : categories.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                  <Layers size={32} className="mx-auto mb-2 opacity-30" />No categories found
                </td></tr>
              ) : categories.map(c => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, rgba(26,58,107,0.1), rgba(200,150,62,0.1))' }}>
                        <Layers size={13} className="text-blue-700" />
                      </div>
                      <span className="font-600 text-gray-900">{c.name}</span>
                    </div>
                  </td>
                  <td className="text-gray-500 text-sm">{(c as any).parent?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="text-gray-500 text-sm max-w-xs truncate">{c.description ?? '—'}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditCat(c); setShowModal(true) }} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => deleteCategory(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <CategoryModal
          cat={editCat}
          allCategories={categories}
          onClose={() => { setShowModal(false); setEditCat(null) }}
          onSave={() => { setShowModal(false); setEditCat(null); load() }}
        />
      )}
    </div>
  )
}

function CategoryModal({ cat, allCategories, onClose, onSave }: {
  cat: Category | null
  allCategories: Category[]
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: cat?.name ?? '',
    description: cat?.description ?? '',
    parent_id: cat?.parent_id ?? '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const parents = allCategories.filter(c => c.id !== cat?.id)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, parent_id: form.parent_id || null }
      if (cat) {
        const { error: err } = await supabase.from('categories').update(payload).eq('id', cat.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('categories').insert(payload)
        if (err) throw err
      }
      onSave()
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-700 text-xl text-gray-900">{cat ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-600 text-gray-700 mb-1.5">Category Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className="form-input" required />
          </div>
          <div>
            <label className="block text-sm font-600 text-gray-700 mb-1.5">Parent Category</label>
            <select value={form.parent_id} onChange={e => set('parent_id', e.target.value)} className="form-input">
              <option value="">— None (Top Level) —</option>
              {parents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-600 text-gray-700 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} className="form-input" rows={3} />
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : cat ? 'Update' : 'Add Category'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
