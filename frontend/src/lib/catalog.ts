import type { ActivityCategory, CategorySlug, PresetActivity } from '../types'

/** System categories. IDs match the seed rows in supabase/schema.sql. */
export const CATEGORIES: ActivityCategory[] = [
  { id: 'a0000000-0000-0000-0000-000000000001', name: 'Workout', slug: 'workout', icon: '💪', color: '#ef4444', is_system: true, user_id: null },
  { id: 'a0000000-0000-0000-0000-000000000002', name: 'Habits', slug: 'habit', icon: '🔄', color: '#3b82f6', is_system: true, user_id: null },
  { id: 'a0000000-0000-0000-0000-000000000003', name: 'Skill Practice', slug: 'skill', icon: '🎯', color: '#a855f7', is_system: true, user_id: null },
  { id: 'a0000000-0000-0000-0000-000000000004', name: 'Mood & Journal', slug: 'mood', icon: '😊', color: '#f59e0b', is_system: true, user_id: null },
  { id: 'a0000000-0000-0000-0000-000000000005', name: 'Custom', slug: 'custom', icon: '⚡', color: '#10b981', is_system: true, user_id: null },
]

const catId = (slug: CategorySlug) => CATEGORIES.find((c) => c.slug === slug)!.id

type P = Omit<PresetActivity, 'category_id'>
const RAW: P[] = [
  { category_slug: 'workout', name: 'Strength Training', icon: '🏋️', color: '#ef4444', unit: 'minutes', daily_target: null },
  { category_slug: 'workout', name: 'Running', icon: '🏃', color: '#f97316', unit: 'km', daily_target: 5 },
  { category_slug: 'workout', name: 'Cycling', icon: '🚴', color: '#f43f5e', unit: 'km', daily_target: null },
  { category_slug: 'workout', name: 'Yoga', icon: '🧘', color: '#ec4899', unit: 'minutes', daily_target: 20 },
  { category_slug: 'workout', name: 'HIIT', icon: '🔥', color: '#dc2626', unit: 'minutes', daily_target: 20 },
  { category_slug: 'workout', name: 'Walking', icon: '🚶', color: '#fb923c', unit: 'count', daily_target: 8000 },
  { category_slug: 'habit', name: 'Meditation', icon: '🧠', color: '#3b82f6', unit: 'minutes', daily_target: 10 },
  { category_slug: 'habit', name: 'Reading', icon: '📚', color: '#6366f1', unit: 'pages', daily_target: 20 },
  { category_slug: 'habit', name: 'Sleep', icon: '😴', color: '#1d4ed8', unit: 'count', daily_target: 8 },
  { category_slug: 'habit', name: 'Water', icon: '💧', color: '#0ea5e9', unit: 'liters', daily_target: 2 },
  { category_slug: 'habit', name: 'Cold Shower', icon: '🚿', color: '#06b6d4', unit: 'boolean', daily_target: null },
  { category_slug: 'habit', name: 'Journaling', icon: '✍️', color: '#2563eb', unit: 'count', daily_target: 200 },
  { category_slug: 'skill', name: 'Coding Practice', icon: '💻', color: '#a855f7', unit: 'minutes', daily_target: 30 },
  { category_slug: 'skill', name: 'Language Learning', icon: '🗣️', color: '#9333ea', unit: 'minutes', daily_target: 15 },
  { category_slug: 'skill', name: 'Music Practice', icon: '🎸', color: '#c026d3', unit: 'minutes', daily_target: 30 },
  { category_slug: 'skill', name: 'Drawing', icon: '🎨', color: '#d946ef', unit: 'minutes', daily_target: null },
  { category_slug: 'mood', name: 'Mood Check-in', icon: '😊', color: '#f59e0b', unit: 'boolean', daily_target: null },
  { category_slug: 'mood', name: 'Gratitude', icon: '🙏', color: '#eab308', unit: 'count', daily_target: 3 },
]

export const PRESETS: PresetActivity[] = RAW.map((p) => ({ ...p, category_id: catId(p.category_slug) }))
