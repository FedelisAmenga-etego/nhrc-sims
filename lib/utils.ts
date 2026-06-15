import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'GHS'): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-GH').format(num)
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, fmt)
}

export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm')
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700 border-gray-200',
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    issued: 'bg-purple-50 text-purple-700 border-purple-200',
    active: 'bg-green-50 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-600 border-gray-200',
    low_stock: 'bg-amber-50 text-amber-700 border-amber-200',
    out_of_stock: 'bg-red-50 text-red-700 border-red-200',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-600'
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    store_manager: 'Store Manager',
    store_officer: 'Store Officer',
    viewer: 'Viewer',
  }
  return labels[role] ?? role
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    admin: 'bg-red-50 text-red-700 border-red-200',
    store_manager: 'bg-blue-50 text-blue-700 border-blue-200',
    store_officer: 'bg-green-50 text-green-700 border-green-200',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return colors[role] ?? 'bg-gray-100 text-gray-600'
}

export function getStockStatus(qty: number, reorder: number): { label: string; color: string } {
  if (qty <= 0) return { label: 'Out of Stock', color: 'text-red-600' }
  if (qty <= reorder) return { label: 'Low Stock', color: 'text-amber-600' }
  return { label: 'In Stock', color: 'text-green-600' }
}

export function truncate(str: string, length = 50): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}

export function generateExportFilename(prefix: string, ext = 'csv'): string {
  return `${prefix}-${format(new Date(), 'yyyy-MM-dd')}.${ext}`
}

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h]
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') ? `"${str}"` : str
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
