'use client'

import { useState, useEffect } from 'react'
import { Bell, Menu, Search, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import { getRoleLabel, getRoleColor } from '@/lib/utils'
import Link from 'next/link'

interface TopbarProps {
  onMenuClick: () => void
  pageTitle?: string
}

export default function Topbar({ onMenuClick, pageTitle }: TopbarProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) setProfile(data)

      const { count } = await supabase
        .from('stock_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('is_resolved', false)
      setAlertCount(count ?? 0)
    }
    load()
  }, [])

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-5 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        {pageTitle && (
          <h1 className="font-display font-700 text-gray-800 text-lg hidden sm:block">{pageTitle}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Alerts */}
        <Link
          href="/inventory?filter=low_stock"
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Bell size={19} />
          {alertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-600">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </Link>

        {/* Profile */}
        {profile && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-700 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1a3a6b, #c8963e)' }}>
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-600 text-gray-800 leading-tight">{profile.full_name.split(' ')[0]}</div>
              <div className={`badge text-xs mt-0.5 ${getRoleColor(profile.role)}`} style={{ padding: '1px 7px', fontSize: '10px' }}>
                {getRoleLabel(profile.role)}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
