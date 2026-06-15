'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime, exportToCSV, generateExportFilename } from '@/lib/utils'
import { Search, Download, ChevronLeft, ChevronRight, ClipboardList, RefreshCw } from 'lucide-react'

const PAGE_SIZE = 25

const ACTION_COLORS: Record<string, string> = {
  GRN_APPROVED: 'bg-green-50 text-green-700 border-green-200',
  VOUCHER_ISSUED: 'bg-purple-50 text-purple-700 border-purple-200',
  INSERT: 'bg-blue-50 text-blue-700 border-blue-200',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
}

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => { load() }, [page, search, tableFilter])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('audit_logs')
      .select('*, user:profiles(full_name, employee_id)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

    if (search) q = q.or(`action.ilike.%${search}%,table_name.ilike.%${search}%,record_id.ilike.%${search}%`)
    if (tableFilter) q = q.eq('table_name', tableFilter)

    const { data, count } = await q
    setLogs(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const tables = ['goods_received_notes', 'issue_vouchers', 'inventory_items', 'suppliers', 'departments', 'profiles', 'stock_adjustments']

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-subtitle">Complete log of all system activities</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary"><RefreshCw size={15} /> Refresh</button>
          <button onClick={() => exportToCSV(logs.map(l => ({
            'Timestamp': formatDateTime(l.created_at),
            'User': l.user?.full_name ?? 'System',
            'Action': l.action,
            'Table': l.table_name,
            'Record ID': l.record_id ?? '',
          })), generateExportFilename('audit-log'))} className="btn-secondary"><Download size={15} /> Export</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} className="form-input pl-9" placeholder="Search actions, tables, records…" />
        </div>
        <select value={tableFilter} onChange={e => { setTableFilter(e.target.value); setPage(1) }} className="form-input w-auto min-w-[180px]">
          <option value="">All Tables</option>
          {tables.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Table</th>
                <th>Record ID</th>
                <th className="text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400"><RefreshCw size={18} className="inline animate-spin mr-2" />Loading…</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400"><ClipboardList size={32} className="mx-auto mb-2 opacity-30" />No audit logs found</td></tr>
              ) : logs.map(log => (
                <tr key={log.id}>
                  <td className="text-gray-600 text-sm whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td>
                    <div className="text-sm font-600 text-gray-800">{log.user?.full_name ?? 'System'}</div>
                    {log.user?.employee_id && <div className="text-xs text-gray-400">{log.user.employee_id}</div>}
                  </td>
                  <td>
                    <span className={`badge ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td><code className="text-xs bg-gray-50 px-2 py-0.5 rounded font-mono text-gray-600">{log.table_name}</code></td>
                  <td className="text-xs text-gray-400 font-mono">{log.record_id ? log.record_id.slice(0, 12) + '…' : '—'}</td>
                  <td>
                    {(log.old_values || log.new_values) && (
                      <div className="flex justify-end">
                        <button onClick={() => setSelectedLog(log)} className="text-xs text-blue-600 hover:underline font-600">View</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50 text-sm text-gray-500">
            <span>Page {page} of {totalPages} · {total} entries</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft size={16} /></button>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="card w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="font-display font-700 text-lg text-gray-900">Audit Log Details</h2>
                <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(selectedLog.created_at)}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">User:</span> <span className="font-600 ml-1">{selectedLog.user?.full_name ?? 'System'}</span></div>
                <div><span className="text-gray-500">Action:</span> <span className="font-600 ml-1">{selectedLog.action}</span></div>
                <div><span className="text-gray-500">Table:</span> <code className="ml-1 text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{selectedLog.table_name}</code></div>
                <div><span className="text-gray-500">Record:</span> <code className="ml-1 text-xs bg-gray-50 px-2 py-0.5 rounded font-mono">{selectedLog.record_id}</code></div>
              </div>
              {selectedLog.old_values && (
                <div>
                  <div className="text-xs font-700 text-gray-500 uppercase tracking-wide mb-2">Previous Values</div>
                  <pre className="bg-red-50 border border-red-100 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_values && (
                <div>
                  <div className="text-xs font-700 text-gray-500 uppercase tracking-wide mb-2">New Values</div>
                  <pre className="bg-green-50 border border-green-100 rounded-lg p-3 text-xs overflow-x-auto text-gray-700">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
