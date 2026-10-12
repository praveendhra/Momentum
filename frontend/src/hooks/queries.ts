import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { store, type ActivityInput, type ActivityPatch, type LogFilters, type LogPatch } from '../lib/store'
import { CATEGORIES, PRESETS } from '../lib/catalog'
import * as stats from '../lib/stats'
import type { Activity, ActivityLog, LogCreated, LogInput } from '../types'

export type { ActivityInput, LogFilters }

export interface GraphFilters {
  year?: number
  activity_id?: string
  category_id?: string
}

const qk = {
  activities: ['activities'] as const,
  allLogs: ['logs', 'all'] as const,
  logs: (f: LogFilters) => ['logs', 'list', f] as const,
}

// Static catalogue, exposed as queries so components don't care where it comes from.
export const useCategories = () => ({ data: CATEGORIES, isLoading: false, error: null })
export const usePresets = () => ({ data: PRESETS, isLoading: false, error: null })

export const useActivities = () => useQuery({ queryKey: qk.activities, queryFn: () => store.listActivities() })

export const useLogs = (filters: LogFilters) =>
  useQuery({ queryKey: qk.logs(filters), queryFn: () => store.listLogs(filters) })

/** Every log for the signed-in user; all stats are derived from this. */
const useAllLogs = () => useQuery({ queryKey: qk.allLogs, queryFn: () => store.allLogs() })

function useDerived<T>(fn: (logs: ActivityLog[], acts: Activity[]) => T) {
  const logs = useAllLogs()
  const acts = useActivities()
  const ready = logs.data && acts.data
  return {
    data: ready ? fn(logs.data!, acts.data!) : undefined,
    isLoading: logs.isLoading || acts.isLoading,
    error: logs.error ?? acts.error,
  }
}

export const useActivityGraph = (f: GraphFilters) => useDerived((l, a) => stats.activityGraph(l, a, f))
export const useDayBreakdown = (f: GraphFilters) => useDerived((l, a) => stats.dayBreakdown(l, a, f))
export const useSummary = () => useDerived(stats.summary)
export const useStreaks = () => useDerived(stats.streaks)
export const usePersonalRecords = () => useDerived(stats.personalRecords)
export const useCorrelations = () => useDerived(stats.correlations)

function useInvalidateLogs() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['logs'] })
}

export function useCreateLog() {
  const qc = useQueryClient()
  const invalidate = useInvalidateLogs()
  return useMutation({
    mutationFn: async (data: LogInput): Promise<LogCreated> => {
      const before = qc.getQueryData<ActivityLog[]>(qk.allLogs) ?? (await store.allLogs())
      const log = await store.createLog(data)
      const activity = qc.getQueryData<Activity[]>(qk.activities)?.find((a) => a.id === log.activity_id)
      return { ...log, new_records: activity ? stats.newRecordsFor(log, before, activity) : [] }
    },
    onSuccess: invalidate,
  })
}

export function useUpdateLog() {
  const invalidate = useInvalidateLogs()
  return useMutation({
    mutationFn: ({ id, ...patch }: LogPatch & { id: string }) => store.updateLog(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteLog() {
  const invalidate = useInvalidateLogs()
  return useMutation({ mutationFn: (id: string) => store.deleteLog(id), onSuccess: invalidate })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ActivityInput) => store.createActivity(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.activities }),
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: ActivityPatch & { id: string }) => store.updateActivity(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.activities }),
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => store.deleteActivity(id),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: qk.activities }), qc.invalidateQueries({ queryKey: ['logs'] })]),
  })
}
