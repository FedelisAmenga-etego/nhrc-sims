'use client'

import { useState, useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inventory': 'Inventory Management',
  '/stock-in': 'Stock In — Goods Received',
  '/stock-out': 'Stock Out — Issue Vouchers',
  '/suppliers': 'Suppliers',
  '/departments': 'Departments',
  '/staff': 'Staff & Users',
  '/reports': 'Reports & Analytics',
  '/audit': 'Audit Trail',
  '/settings': 'Settings',
  '/categories': 'Categories',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth/login')
    })
  }, [])

  const title = Object.entries(pageTitles).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1] ?? 'NHRC Stores MIS'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col flex-shrink-0"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            className="relative z-10 flex flex-col"
            style={{ width: 'var(--sidebar-width)' }}
          >
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          pageTitle={title}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="p-5 lg:p-7 max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
