'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, formatDate, exportToCSV, generateExportFilename } from '@/lib/utils'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { Download, RefreshCw, BarChart2, TrendingUp, Package, AlertTriangle } from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

const COLORS = ['#1a3a6b', '#c8963e', '#0e8a6e', '#7c3aed', '#dc2626', '#0891b2', '#d97706', '#059669']

type ReportTab = 'stock_valuation' | 'movement' | 'low_stock' | 'department_usage' | 'supplier_performance'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('stock_valuation')
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'))
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Data states
  const [valuationData, setValuationData] = useState<any[]>([])
  const [movementData, setMovementData] = useState<any[]>([])
  const [lowStockData, setLowStockData] = useState<any[]>([])
  const [deptUsageData, setDeptUsageData] = useState<any[]>([])
  const [supplierData, setSupplierData] = useState<any[]>([])
  const [valuationSummary, setValuationSummary] = useState({ total: 0, items: 0, categories: 0 })

  const supabase = createClient()

  useEffect(() => { loadReport() }, [activeTab, fromDate, toDate])

  async function loadReport() {
    setLoading(true)
    try {
      if (activeTab === 'stock_valuation') await loadValuation()
      if (activeTab === 'movement') await loadMovement()
      if (activeTab === 'low_stock') await loadLowStock()
      if (activeTab === 'department_usage') await loadDeptUsage()
      if (activeTab === 'supplier_performance') await loadSupplierPerf()
    } finally {
      setLoading(false)
    }
  }

  async function loadValuation() {
    const { data } = await supabase
      .from('inventory_items')
      .select('name, quantity_in_stock, unit_cost, total_value, category:categories(name), unit:units(abbreviation)')
      .eq('is_active', true)
      .order('total_value', { ascending: false })

    const items = data ?? []
    const catMap: Record<string, { value: number; count: number }> = {}
    items.forEach((i: any) => {
      const cat = i.category?.name ?? 'Uncategorized'
      if (!catMap[cat]) catMap[cat] = { value: 0, count: 0 }
      catMap[cat].value += i.total_value ?? 0
      catMap[cat].count++
    })
    setValuationData(items)
    setValuationSummary({
      total: items.reduce((s: number, i: any) => s + (i.total_value ?? 0), 0),
      items: items.length,
      categories: Object.keys(catMap).length,
    })
  }

  async function loadMovement() {
    const months: { label: string; receipts: number; issues: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const start = format(startOfMonth(d), 'yyyy-MM-dd')
      const end = format(endOfMonth(d), 'yyyy-MM-dd')
      const label = format(d, 'MMM yyyy')

      const [grnRes, issRes] = await Promise.all([
        supabase.from('goods_received_notes').select('total_value').eq('status', 'approved').gte('received_date', start).lte('received_date', end),
        supabase.from('issue_vouchers').select('total_value').eq('status', 'issued').gte('issued_date', start).lte('issued_date', end),
      ])
      months.push({
        label,
        receipts: (grnRes.data ?? []).reduce((s, g) => s + (g.total_value ?? 0), 0),
        issues: (issRes.data ?? []).reduce((s, v) => s + (v.total_value ?? 0), 0),
      })
    }
    setMovementData(months)
  }

  async function loadLowStock() {
    const { data } = await supabase
      .from('inventory_items')
      .select('name, item_code, quantity_in_stock, reorder_level, reorder_quantity, unit_cost, total_value, category:categories(name), unit:units(abbreviation)')
      .eq('is_active', true)
      .lte('quantity_in_stock', supabase.rpc as any)

    const all = (data ?? [])
    const low = all.filter((i: any) => i.quantity_in_stock <= i.reorder_level)
    setLowStockData(low.sort((a: any, b: any) => (a.quantity_in_stock / (a.reorder_level || 1)) - (b.quantity_in_stock / (b.reorder_level || 1))))
  }

  async function loadDeptUsage() {
    const { data } = await supabase
      .from('issue_vouchers')
      .select('department:departments(name), total_value, issued_date')
      .eq('status', 'issued')
      .gte('issued_date', fromDate)
      .lte('issued_date', toDate)

    const deptMap: Record<string, number> = {}
    ;(data ?? []).forEach((v: any) => {
      const name = v.department?.name ?? 'Unknown'
      deptMap[name] = (deptMap[name] ?? 0) + (v.total_value ?? 0)
    })
    setDeptUsageData(Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value))
  }

  async function loadSupplierPerf() {
    const { data } = await supabase
      .from('goods_received_notes')
      .select('supplier:suppliers(name), total_value, status, received_date')
      .gte('received_date', fromDate)
      .lte('received_date', toDate)

    const suppMap: Record<string, { total: number; count: number; approved: number }> = {}
    ;(data ?? []).forEach((g: any) => {
      const name = g.supplier?.name ?? 'Unknown'
      if (!suppMap[name]) suppMap[name] = { total: 0, count: 0, approved: 0 }
      suppMap[name].count++
      if (g.status === 'approved') {
        suppMap[name].total += g.total_value ?? 0
        suppMap[name].approved++
      }
    })
    setSupplierData(Object.entries(suppMap).map(([name, d]) => ({
      name,
      total: d.total,
      count: d.count,
      approved: d.approved,
      rate: d.count > 0 ? Math.round((d.approved / d.count) * 100) : 0,
    })).sort((a, b) => b.total - a.total))
  }

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: 'stock_valuation', label: 'Stock Valuation', icon: <Package size={15} /> },
    { key: 'movement', label: 'Stock Movement', icon: <TrendingUp size={15} /> },
    { key: 'low_stock', label: 'Low Stock', icon: <AlertTriangle size={15} /> },
    { key: 'department_usage', label: 'Dept. Usage', icon: <BarChart2 size={15} /> },
    { key: 'supplier_performance', label: 'Supplier Perf.', icon: <BarChart2 size={15} /> },
  ]

  function handleExport() {
    if (activeTab === 'stock_valuation') {
      exportToCSV(valuationData.map((i: any) => ({
        'Item Name': i.name, 'Category': i.category?.name ?? '', 'Unit': i.unit?.abbreviation ?? '',
        'Qty': i.quantity_in_stock, 'Unit Cost (GHS)': i.unit_cost, 'Total Value (GHS)': i.total_value,
      })), generateExportFilename('stock-valuation'))
    } else if (activeTab === 'low_stock') {
      exportToCSV(lowStockData.map((i: any) => ({
        'Item': i.name, 'Code': i.item_code, 'Category': i.category?.name ?? '',
        'In Stock': i.quantity_in_stock, 'Reorder Level': i.reorder_level, 'Reorder Qty': i.reorder_quantity,
        'Unit Cost': i.unit_cost,
      })), generateExportFilename('low-stock'))
    } else if (activeTab === 'department_usage') {
      exportToCSV(deptUsageData, generateExportFilename('dept-usage'))
    } else if (activeTab === 'supplier_performance') {
      exportToCSV(supplierData, generateExportFilename('supplier-perf'))
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Analytics</h1>
          <p className="page-subtitle">Comprehensive stores performance insights</p>
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={loadReport} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>
          <button onClick={handleExport} className="btn-secondary"><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {/* Date range (for date-sensitive reports) */}
      {['movement', 'department_usage', 'supplier_performance'].includes(activeTab) && (
        <div className="card p-4 mb-5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-600 text-gray-700">From:</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="form-input w-auto" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-600 text-gray-700">To:</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="form-input w-auto" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-100 overflow-x-auto pb-px">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-600 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.key
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-gray-400">
          <RefreshCw size={18} className="animate-spin" /> Loading report…
        </div>
      ) : (
        <>
          {activeTab === 'stock_valuation' && (
            <div className="space-y-6">
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="stat-card">
                  <div className="text-xs text-gray-500 mb-1 font-display uppercase tracking-wide">Total Stock Value</div>
                  <div className="font-display font-700 text-2xl text-gray-900">{formatCurrency(valuationSummary.total)}</div>
                </div>
                <div className="stat-card">
                  <div className="text-xs text-gray-500 mb-1 font-display uppercase tracking-wide">Active Items</div>
                  <div className="font-display font-700 text-2xl text-gray-900">{formatNumber(valuationSummary.items)}</div>
                </div>
                <div className="stat-card">
                  <div className="text-xs text-gray-500 mb-1 font-display uppercase tracking-wide">Categories</div>
                  <div className="font-display font-700 text-2xl text-gray-900">{valuationSummary.categories}</div>
                </div>
              </div>

              {/* Top 10 by value chart */}
              <div className="card p-5">
                <h3 className="font-display font-700 text-gray-900 mb-4">Top 10 Items by Value</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={valuationData.slice(0, 10)} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={140} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="total_value" name="Value (GHS)" fill="#1a3a6b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Full table */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <h3 className="font-display font-700 text-gray-900">Full Stock Valuation Report</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Item Name</th><th>Category</th><th>Unit</th>
                        <th className="text-right">Qty</th><th className="text-right">Unit Cost</th><th className="text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuationData.map((item: any, idx) => (
                        <tr key={item.id ?? idx}>
                          <td className="text-gray-400 text-sm">{idx + 1}</td>
                          <td className="font-600 text-gray-900">{item.name}</td>
                          <td className="text-gray-500 text-sm">{item.category?.name ?? '—'}</td>
                          <td className="text-gray-500 text-sm">{item.unit?.abbreviation ?? '—'}</td>
                          <td className="text-right font-600">{formatNumber(item.quantity_in_stock)}</td>
                          <td className="text-right text-gray-600">{formatCurrency(item.unit_cost)}</td>
                          <td className="text-right font-700 text-gray-900">{formatCurrency(item.total_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} className="text-right font-700 text-gray-700 py-3 px-4">Grand Total:</td>
                        <td className="text-right font-700 text-gray-900 py-3 px-4">{formatCurrency(valuationSummary.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'movement' && (
            <div className="space-y-6">
              <div className="card p-5">
                <h3 className="font-display font-700 text-gray-900 mb-1">Stock Movement — Last 6 Months</h3>
                <p className="text-xs text-gray-400 mb-5">Receipts vs Issues by value (GHS)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={movementData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    <Legend />
                    <Bar dataKey="receipts" name="Receipts (GHS)" fill="#1a3a6b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="issues" name="Issues (GHS)" fill="#c8963e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>Month</th><th className="text-right">Receipts (GHS)</th><th className="text-right">Issues (GHS)</th><th className="text-right">Net Movement</th></tr></thead>
                  <tbody>
                    {movementData.map((m, i) => (
                      <tr key={i}>
                        <td className="font-600">{m.label}</td>
                        <td className="text-right text-green-700 font-600">{formatCurrency(m.receipts)}</td>
                        <td className="text-right text-amber-700 font-600">{formatCurrency(m.issues)}</td>
                        <td className={`text-right font-700 ${m.receipts - m.issues >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(m.receipts - m.issues)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'low_stock' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-sm text-amber-800">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span><strong>{lowStockData.length}</strong> items are at or below reorder level and need attention.</span>
              </div>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr><th>#</th><th>Item</th><th>Code</th><th>Category</th><th className="text-right">In Stock</th><th className="text-right">Reorder Level</th><th className="text-right">Reorder Qty</th><th className="text-right">Est. Cost to Reorder</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {lowStockData.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-10 text-gray-400">All stock levels are healthy</td></tr>
                      ) : lowStockData.map((item: any, idx) => (
                        <tr key={item.id ?? idx}>
                          <td className="text-gray-400 text-sm">{idx + 1}</td>
                          <td className="font-600 text-gray-900">{item.name}</td>
                          <td><code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{item.item_code}</code></td>
                          <td className="text-gray-500 text-sm">{item.category?.name ?? '—'}</td>
                          <td className={`text-right font-700 ${item.quantity_in_stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{item.quantity_in_stock} {item.unit?.abbreviation}</td>
                          <td className="text-right text-gray-600">{item.reorder_level}</td>
                          <td className="text-right text-gray-600">{item.reorder_quantity}</td>
                          <td className="text-right font-600 text-gray-800">{formatCurrency(item.reorder_quantity * item.unit_cost)}</td>
                          <td>
                            {item.quantity_in_stock <= 0
                              ? <span className="badge bg-red-50 text-red-700 border-red-200">Out of Stock</span>
                              : <span className="badge bg-amber-50 text-amber-700 border-amber-200">Low Stock</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {lowStockData.length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={7} className="text-right font-700 text-gray-700 py-3 px-4">Total Est. Reorder Cost:</td>
                          <td className="text-right font-700 text-gray-900 py-3 px-4">
                            {formatCurrency(lowStockData.reduce((s: number, i: any) => s + (i.reorder_quantity * i.unit_cost), 0))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'department_usage' && (
            <div className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-5">
                <div className="card p-5">
                  <h3 className="font-display font-700 text-gray-900 mb-4">Issues by Department (Value)</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={deptUsageData} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="value" name="Value Issued (GHS)" fill="#c8963e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="card p-5">
                  <h3 className="font-display font-700 text-gray-900 mb-4">Department Share</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={deptUsageData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={3}>
                        {deptUsageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card overflow-hidden">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Department</th><th className="text-right">Total Value Issued (GHS)</th><th className="text-right">% of Total</th></tr></thead>
                  <tbody>
                    {deptUsageData.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-10 text-gray-400">No data for selected period</td></tr>
                    ) : (
                      (() => {
                        const total = deptUsageData.reduce((s, d) => s + d.value, 0)
                        return deptUsageData.map((d, i) => (
                          <tr key={i}>
                            <td className="text-gray-400">{i + 1}</td>
                            <td className="font-600 text-gray-900">{d.name}</td>
                            <td className="text-right font-700">{formatCurrency(d.value)}</td>
                            <td className="text-right text-gray-600">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ))
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'supplier_performance' && (
            <div className="space-y-5">
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-gray-50">
                  <h3 className="font-display font-700 text-gray-900">Supplier Performance Report</h3>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(fromDate)} – {formatDate(toDate)}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Supplier</th><th className="text-right">Total GRNs</th><th className="text-right">Approved</th><th className="text-right">Approval Rate</th><th className="text-right">Total Value (GHS)</th></tr></thead>
                    <tbody>
                      {supplierData.length === 0 ? (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">No data for selected period</td></tr>
                      ) : supplierData.map((s, i) => (
                        <tr key={i}>
                          <td className="text-gray-400">{i + 1}</td>
                          <td className="font-600 text-gray-900">{s.name}</td>
                          <td className="text-right">{s.count}</td>
                          <td className="text-right text-green-700 font-600">{s.approved}</td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${s.rate}%` }} />
                              </div>
                              <span className="text-sm font-600">{s.rate}%</span>
                            </div>
                          </td>
                          <td className="text-right font-700">{formatCurrency(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
