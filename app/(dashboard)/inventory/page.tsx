'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, getStockStatus, exportToCSV, generateExportFilename } from '@/lib/utils'
import {
  Plus, Search, Filter, Download, Edit2, Trash2,
  AlertTriangle, X, ChevronLeft, ChevronRight, Package, RefreshCw
} from 'lucide-react'
import type { InventoryItem, Category, Unit } from '@/types'

const PAGE_SIZE = 20

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<InventoryItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => { loadMeta() }, [])
  useEffect(() => { loadItems() }, [page, search, categoryFilter, stockFilter])

  async function loadMeta() {
    const [catRes, unitRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('units').select('*').order('name'),
    ])
    setCategories(catRes.data ?? [])
    setUnits(unitRes.data ?? [])
  }

  async function loadItems() {
    setLoading(true)
    let q = supabase
      .from('inventory_items')
      .select('*, category:categories(id,name), unit:units(id,name,abbreviation)', { count: 'exact' })
      .eq('is_active', true)
      .order('name')
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) q = q.ilike('name', `%${search}%`)
    if (categoryFilter) q = q.eq('category_id', categoryFilter)
    if (stockFilter === 'low_stock') q = q.gt('quantity_in_stock', 0).lte('quantity_in_stock', supabase.rpc as any)
    // Manual filter for stock status after fetch
    const { data, count } = await q
    let filtered = data ?? []
    if (stockFilter === 'low_stock') filtered = filtered.filter(i => i.quantity_in_stock > 0 && i.quantity_in_stock <= i.reorder_level)
    if (stockFilter === 'out_of_stock') filtered = filtered.filter(i => i.quantity_in_stock <= 0)
    if (stockFilter === 'in_stock') filtered = filtered.filter(i => i.quantity_in_stock > i.reorder_level)
    setItems(filtered)
    setTotal(count ?? 0)
    setLoading(false)
  }

  function handleExport() {
    const rows = items.map(i => ({
      'Item Code': i.item_code,
      'Name': i.name,
      'Category': (i as any).category?.name ?? '',
      'Unit': (i as any).unit?.abbreviation ?? '',
      'Qty in Stock': i.quantity_in_stock,
      'Reorder Level': i.reorder_level,
      'Unit Cost (GHS)': i.unit_cost,
      'Total Value (GHS)': i.total_value,
      'Location': i.location ?? '',
      'Bin No': i.bin_number ?? '',
    }))
    exportToCSV(rows, generateExportFilename('inventory'))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">{formatNumber(total)} items tracked</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary"><Download size={15} /> Export</button>
          <button onClick={() => { setEditItem(null); setShowModal(true) }} className="btn-primary">
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="form-input pl-9"
            placeholder="Search items…"
          />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[160px]">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockFilter} onChange={e => { setStockFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[140px]">
          <option value="">All Stock Status</option>
          <option value="in_stock">In Stock</option>
          <option value="low_stock">Low Stock</option>
          <option value="out_of_stock">Out of Stock</option>
        </select>
        {(search || categoryFilter || stockFilter) && (
          <button onClick={() => { setSearch(''); setCategoryFilter(''); setStockFilter(''); setPage(1) }}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="text-right">Qty in Stock</th>
                <th className="text-right">Reorder Level</th>
                <th className="text-right">Unit Cost</th>
                <th className="text-right">Total Value</th>
                <th>Location</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">
                  <RefreshCw size={18} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-12 text-gray-400">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />No items found
                </td></tr>
              ) : items.map(item => {
                const { label, color } = getStockStatus(item.quantity_in_stock, item.reorder_level)
                return (
                  <tr key={item.id}>
                    <td><code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{item.item_code}</code></td>
                    <td>
                      <div className="font-600 text-gray-800">{item.name}</div>
                      {item.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</div>}
                    </td>
                    <td className="text-gray-600">{(item as any).category?.name ?? '—'}</td>
                    <td className="text-gray-600">{(item as any).unit?.abbreviation ?? '—'}</td>
                    <td className={`text-right font-700 ${color}`}>{formatNumber(item.quantity_in_stock)}</td>
                    <td className="text-right text-gray-500">{formatNumber(item.reorder_level)}</td>
                    <td className="text-right text-gray-700">{formatCurrency(item.unit_cost)}</td>
                    <td className="text-right font-700 text-gray-800">{formatCurrency(item.total_value)}</td>
                    <td className="text-gray-500 text-sm">{item.location ?? '—'}</td>
                    <td>
                      <span className={`badge ${label === 'Out of Stock' ? 'bg-red-50 text-red-700 border-red-200' : label === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                        {label}
                      </span>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditItem(item); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 text-sm text-gray-500">
            <span>Page {page} of {totalPages} · {formatNumber(total)} items</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ItemModal
          item={editItem}
          categories={categories}
          units={units}
          onClose={() => { setShowModal(false); setEditItem(null) }}
          onSave={() => { setShowModal(false); setEditItem(null); loadItems() }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <ConfirmModal
          message="Are you sure you want to deactivate this item? It will be hidden but not permanently deleted."
          onConfirm={async () => {
            await supabase.from('inventory_items').update({ is_active: false }).eq('id', deleteConfirm)
            setDeleteConfirm(null)
            loadItems()
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

function ItemModal({ item, categories, units, onClose, onSave }: {
  item: InventoryItem | null
  categories: Category[]
  units: Unit[]
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    category_id: item?.category_id ?? '',
    unit_id: item?.unit_id ?? '',
    quantity_in_stock: item?.quantity_in_stock ?? 0,
    reorder_level: item?.reorder_level ?? 0,
    reorder_quantity: item?.reorder_quantity ?? 0,
    unit_cost: item?.unit_cost ?? 0,
    location: item?.location ?? '',
    bin_number: item?.bin_number ?? '',
    notes: item?.notes ?? '',
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        quantity_in_stock: Number(form.quantity_in_stock),
        reorder_level: Number(form.reorder_level),
        reorder_quantity: Number(form.reorder_quantity),
        unit_cost: Number(form.unit_cost),
        category_id: form.category_id || null,
        item_code: item?.item_code ?? '',
      }
      if (item) {
        const { error: err } = await supabase.from('inventory_items').update(payload).eq('id', item.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('inventory_items').insert(payload)
        if (err) throw err
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
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-display font-700 text-xl text-gray-900">{item ? 'Edit Item' : 'Add New Item'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Item Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} className="form-input" required />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className="form-input" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Category</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} className="form-input">
                <option value="">— Select Category —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Unit of Measure *</label>
              <select value={form.unit_id} onChange={e => set('unit_id', e.target.value)} className="form-input" required>
                <option value="">— Select Unit —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Quantity in Stock</label>
              <input type="number" min="0" step="0.01" value={form.quantity_in_stock} onChange={e => set('quantity_in_stock', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Reorder Level</label>
              <input type="number" min="0" step="0.01" value={form.reorder_level} onChange={e => set('reorder_level', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Reorder Quantity</label>
              <input type="number" min="0" step="0.01" value={form.reorder_quantity} onChange={e => set('reorder_quantity', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Unit Cost (GHS)</label>
              <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => set('unit_cost', e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Storage Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)} className="form-input" placeholder="e.g. Shelf A-3" />
            </div>
            <div>
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Bin Number</label>
              <input value={form.bin_number} onChange={e => set('bin_number', e.target.value)} className="form-input" placeholder="e.g. BIN-001" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-600 text-gray-700 mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="form-input" rows={2} />
            </div>
          </div>
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : item ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="card w-full max-w-md p-6">
        <h3 className="font-display font-700 text-lg text-gray-900 mb-2">Confirm Action</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-danger">Confirm</button>
        </div>
      </div>
    </div>
  )
}
