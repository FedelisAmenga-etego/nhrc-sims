'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, ArrowDownToLine, ArrowUpFromLine,
  Truck, Building2, Users, BarChart3, ClipboardList,
  Settings, ChevronDown, Layers, AlertTriangle, LogOut, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Store Operations',
    items: [
      { href: '/inventory', label: 'Inventory', icon: Package },
      { href: '/stock-in', label: 'Stock In (GRN)', icon: ArrowDownToLine },
      { href: '/stock-out', label: 'Stock Out', icon: ArrowUpFromLine },
      { href: '/categories', label: 'Categories', icon: Layers },
    ],
  },
  {
    label: 'Registry',
    items: [
      { href: '/suppliers', label: 'Suppliers', icon: Truck },
      { href: '/departments', label: 'Departments', icon: Building2 },
      { href: '/staff', label: 'Staff & Users', icon: Users },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/audit', label: 'Audit Trail', icon: ClipboardList },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface SidebarProps {
  onClose?: () => void
  mobile?: boolean
}

export default function Sidebar({ onClose, mobile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--nhrc-navy)' }}>
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #c8963e, #e8b84b)' }}>
            <Package size={18} className="text-white" />
          </div>
          <div>
            <div className="font-display font-700 text-white text-sm leading-tight">NHRC Stores</div>
            <div className="text-white/40 text-xs">Management System</div>
          </div>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-white/60 hover:text-white p-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="text-white/30 text-xs font-display font-600 uppercase tracking-widest px-3 mb-2">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                        active
                          ? 'bg-white/10 text-white font-600'
                          : 'text-white/60 hover:bg-white/6 hover:text-white/90'
                      )}
                    >
                      <Icon size={17} className={cn(
                        'flex-shrink-0 transition-colors',
                        active ? 'text-amber-400' : 'text-white/40 group-hover:text-white/70'
                      )} />
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-white/10 pt-4">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-red-400 hover:bg-red-500/10 w-full transition-all"
        >
          <LogOut size={17} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  )
}
