'use client'

import useSWR, { type KeyedMutator } from 'swr'
import type { DashboardData } from '@/types'

async function fetchDashboard(_key: string, token: string): Promise<DashboardData> {
  const res = await fetch('/api/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch dashboard')
  return res.json() as Promise<DashboardData>
}

interface UseDashboardDataResult {
  data: DashboardData | null
  error: Error | undefined
  isLoading: boolean
  refresh: KeyedMutator<DashboardData>
}

export function useDashboardData(token: string | null): UseDashboardDataResult {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    token ? ['dashboard', token] : null,
    ([, t]: [string, string]) => fetchDashboard('dashboard', t),
  )
  return { data: data ?? null, error, isLoading, refresh: mutate }
}
