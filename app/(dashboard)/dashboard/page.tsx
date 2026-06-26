'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils'
import {
  Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle,
  Truck, Building2, TrendingUp, TrendingDown, BarChart2,
  ShoppingCart, ClipboardCheck, Clock, RefreshCw, Users, ChevronDown
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import Link from 'next/link'
import type { DashboardStats } from '@/types'
import { format, subMonths, startOfMonth } from 'date-fns'

const PIE_COLORS = ['#1a3a6b', '#c8963e', '#0e8a6e', '#7c3aed', '#dc2626', '#0891b2']

interface StoreUser {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<{ month: string; receipts: number; issues: number }[]>([])
  const [categoryData, setCategoryData] = useState<{ name: string; value: number }[]>([])
  const [recentGRNs, setRecentGRNs] = useState<any[]>([])
  const [recentVouchers, setRecentVouchers] = useState<any[]>([])
  const [lowStockItems, setLowStockItems] = useState<any[]>([])
  const [users, setUsers] = useState<StoreUser[]>([])
  const [selectedUser, setSelectedUser] = useState<StoreUser | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      // Executing concurrent database lookups securely, adding profiles/users lookup
      const [
        itemsRes, grnRes, voucherRes, suppRes, deptRes,
        recentGRNRes, recentVoucherRes, catRes, usersRes
      ] = await Promise.all([
        supabase.from('inventory_items').select('id, name, item_code, quantity_in_stock, reorder_level, total_value, unit:units(abbreviation)').eq('is_active', true),
        supabase.from('goods_received_notes').select('id, status, total_value, received_date').eq('status', 'approved'),
        supabase.from('issue_vouchers').select('id, status, total_value, issued_date').eq('status', 'issued'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('departments').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('goods_received_notes').select('id, grn_number, supplier:suppliers(name), total_value, status, received_date').order('created_at', { ascending: false }).limit(5),
        supabase.from('issue_vouchers').select('id, voucher_number, department:departments(name), total_value, status, request_date').order('created_at', { ascending: false }).limit(5),
        supabase.from('inventory_items').select('category:categories(name), total_value').eq('is_active', true),
        supabase.from('profiles').select('id, full_name, email, role').order('full_name', { ascending: true }) // Adjust table name if yours is 'users'
      ])

      const items = itemsRes.data ?? []
      const totalValue = items.reduce((s, i) => s + (i.total_value ?? 0), 0)
      const lowStockCount = items.filter(i => i.quantity_in_stock > 0 && i.quantity_in_stock <= i.reorder_level).length
      const outOfStock = items.filter(i => i.quantity_in_stock <= 0).length

      // Set users dropdown items
      const fetchedUsers = usersRes.data ?? []
      setUsers(fetchedUsers)
      if (fetchedUsers.length > 0 && !selectedUser) {
        setSelectedUser(fetchedUsers[0]) // Defaults to the first user fetched
      }

      // Monthly chart data (last 6 months)
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(new Date(), 5 - i)
        return { month: format(startOfMonth(d), 'MMM'), start: startOfMonth(d), end: startOfMonth(subMonths(d, -1)) }
      })

      const grns = grnRes.data ?? []
      const vouchers = voucherRes.data ?? []

      const chart = months.map(m => ({
        month: m.month,
        receipts: grns.filter(g => {
          const d = new Date(g.received_date)
          return d >= m.start && d < m.end
        }).reduce((s, g) => s + (g.total_value ?? 0), 0),
        issues: vouchers.filter(v => {
          const d = new Date((v as any).issued_date ?? v.issued_date)
          return d >= m.start && d < m.end
        }).reduce((s, v) => s + (v.total_value ?? 0), 0),
      }))
      setChartData(chart)

      // Category breakdown
      const catMap: Record<string, number> = {}
      ;(catRes.data ?? []).forEach((i: any) => {
        const name = i.category?.name ?? 'Uncategorized'
        catMap[name] = (catMap[name] ?? 0) + (i.total_value ?? 0)
      })
      setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6))

      // Low stock
      const lowItems = items
        .filter(i => i.quantity_in_stock <= i.reorder_level)
        .sort((a, b) => a.quantity_in_stock - b.quantity_in_stock)
        .slice(0, 5)
      setLowStockItems(lowItems)

      setRecentGRNs(recentGRNRes.data ?? [])
      setRecentVouchers(recentVoucherRes.data ?? [])

      setStats({
        total_items: items.length,
        total_value: totalValue,
        low_stock_items: lowStockCount,
        out_of_stock_items: outOfStock,
        pending_grns: (grnRes.data ?? []).filter((g: any) => g.status === 'submitted').length,
        pending_requisitions: 0,
        total_suppliers: suppRes.count ?? 0,
        total_departments: deptRes.count ?? 0,
        monthly_receipts: grns.slice(-30).reduce((s, g) => s + (g.total_value ?? 0), 0),
        monthly_issues: vouchers.slice(-30).reduce((s, v) => s + (v.total_value ?? 0), 0),
      })
    } catch (err) {
      console.error('Error loading dashboard statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <RefreshCw size={20} className="animate-spin" />
      Loading dashboard…
    </div>
  )

  return (
    <div className="animate-in space-y-7">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Navrongo Health Research Centre — Stores Overview</p>
        </div>
        
        {/* User Dropdown & Action Controls */}
        <div className="flex items-center gap-3 self-end md:self-auto relative">
          
          {/* Custom Dropdown Container */}
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg text-sm font-500 text-gray-700 shadow-sm hover:bg-gray-50 transition"
            >
              <Users size={16} className="text-gray-400" />
              <span>{selectedUser ? (selectedUser.full_name ?? selectedUser.email) : 'Select User'}</span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-lg z-50 divide-y divide-gray-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-2 text-xs font-600 text-gray-400 bg-gray-50">Active Personnel</div>
                <div className="max-h-60 overflow-y-auto">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user)
                        setIsDropdownOpen(false)
                        // Optional: You could append user specific filtering logic here
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex flex-col hover:bg-gray-50 transition ${selectedUser?.id === user.id ? 'bg-amber-50/40 text-amber-900 font-500' : 'text-gray-700'}`}
                    >
                      <span className="truncate">{user.full_name ?? 'Unnamed User'}</span>
                      <span className="text-xs text-gray-400 font-400 truncate">{user.role ?? user.email}</span>
                    </button>
                  ))}
                  {users.length === 0 && (
                    <div className="px-4 py-3 text-xs text-gray-400">No active users discovered.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={loadDashboard} className="btn-secondary whitespace-nowrap">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Stock Value"
          value={formatCurrency(stats?.total_value ?? 0)}
          icon={<TrendingUp size={20} />}
          color="#1a3a6b"
          badge="GHS"
        />
        <StatCard
          label="Inventory Items"
          value={formatNumber(stats?.total_items ?? 0)}
          icon={<Package size={20} />}
          color="#0e8a6e"
          badge="Active"
        />
        <StatCard
          label="Low Stock Items"
          value={formatNumber(stats?.low_stock_items ?? 0)}
          icon={<AlertTriangle size={20} />}
          color="#d97706"
          badge="Alerts"
          alert={stats?.low_stock_items ? 'Needs attention' : undefined}
        />
        <StatCard
          label="Out of Stock"
          value={formatNumber(stats?.out_of_stock_items ?? 0)}
          icon={<ShoppingCart size={20} />}
          color="#dc2626"
          badge="Critical"
          alert={stats?.out_of_stock_items ? 'Reorder needed' : undefined}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Suppliers"
          value={formatNumber(stats?.total_suppliers ?? 0)}
          icon={<Truck size={20} />}
          color="#7c3aed"
          small
        />
        <StatCard
          label="Departments"
          value={formatNumber(stats?.total_departments ?? 0)}
          icon={<Building2 size={20} />}
          color="#0891b2"
          small
        />
        <StatCard
          label="Pending GRNs"
          value={formatNumber(stats?.pending_grns ?? 0)}
          icon={<ArrowDownToLine size={20} />}
          color="#c8963e"
          small
        />
        <StatCard
          label="Pending Vouchers"
          value={formatNumber(stats?.pending_requisitions ?? 0)}
          icon={<ClipboardCheck size={20} />}
          color="#1a3a6b"
          small
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Area chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display font-700 text-gray-900 text-base">Stock Movement (6 Months)</h3>
              <p className="text-xs text-gray-400 mt-0.5">Receipts vs Issues by value (GHS)</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceipts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a3a6b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1a3a6b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c8963e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#c8963e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
              <Area type="monotone" dataKey="receipts" name="Receipts" stroke="#1a3a6b" strokeWidth={2} fill="url(#colorReceipts)" />
              <Area type="monotone" dataKey="issues" name="Issues" stroke="#c8963e" strokeWidth={2} fill="url(#colorIssues)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="font-display font-700 text-gray-900 text-base mb-1">Stock by Category</h3>
          <p className="text-xs text-gray-400 mb-4">Value distribution</p>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} formatter={(v) => v.length > 18 ? v.slice(0, 18) + '…' : v} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent GRNs */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-50">
            <h3 className="font-display font-700 text-gray-900 text-sm">Recent GRNs</h3>
            <Link href="/stock-in" className="text-xs text-amber-600 hover:underline font-600">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentGRNs.length === 0 && <div className="p-5 text-sm text-gray-400">No GRNs yet</div>}
            {recentGRNs.map((g) => (
              <div key={g.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-600 text-gray-800 truncate">{g.grn_number}</div>
                  <div className="text-xs text-gray-400 truncate">{g.supplier?.name ?? '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-700 text-gray-800">{formatCurrency(g.total_value)}</div>
                  <span className={`badge ${getStatusColor(g.status)}`}>{g.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Vouchers */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-50">
            <h3 className="font-display font-700 text-gray-900 text-sm">Recent Issue Vouchers</h3>
            <Link href="/stock-out" className="text-xs text-amber-600 hover:underline font-600">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {recentVouchers.length === 0 && <div className="p-5 text-sm text-gray-400">No vouchers yet</div>}
            {recentVouchers.map((v) => (
              <div key={v.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-600 text-gray-800 truncate">{v.voucher_number}</div>
                  <div className="text-xs text-gray-400 truncate">{v.department?.name ?? '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-xs font-700 text-gray-800">{formatCurrency(v.total_value)}</div>
                  <span className={`badge ${getStatusColor(v.status)}`}>{v.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between p-5 pb-3 border-b border-gray-50">
            <h3 className="font-display font-700 text-gray-900 text-sm flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-500" /> Low Stock Alerts
            </h3>
            <Link href="/inventory?filter=low_stock" className="text-xs text-amber-600 hover:underline font-600">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {lowStockItems.length === 0 && <div className="p-5 text-sm text-gray-400">All stock levels OK</div>}
            {lowStockItems.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-600 text-gray-800 truncate">{item.name}</div>
                  <div className="text-xs text-gray-400">{item.item_code}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-700 ${item.quantity_in_stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                    {item.quantity_in_stock <= 0 ? 'Out' : `${item.quantity_in_stock}`}
                  </div>
                  <div className="text-xs text-gray-400">of {item.reorder_level} reorder</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    issued: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function StatCard({ label, value, icon, color, badge, alert, small }: {
  label: string; value: string; icon: React.ReactNode
  color: string; badge?: string; alert?: string; small?: boolean
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: color }}>
          {icon}
        </div>
        {badge && !small && (
          <span className="text-xs px-2 py-0.5 rounded-full font-600 text-white" style={{ background: color, opacity: 0.8 }}>
            {badge}
          </span>
        )}
      </div>
      <div className={`font-display font-700 text-gray-900 ${small ? 'text-2xl' : 'text-3xl'}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1 font-500">{label}</div>
      {alert && <div className="text-xs mt-2 font-600" style={{ color }}>{alert}</div>}
    </div>
  )
}
