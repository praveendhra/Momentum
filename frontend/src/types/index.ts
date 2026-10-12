// ─── Activity Categories ───

export type CategorySlug = 'workout' | 'habit' | 'skill' | 'mood' | 'custom'

export interface ActivityCategory {
  id: string
  name: string
  slug: CategorySlug
  icon: string
  color: string
  is_system: boolean
  user_id: string | null
}

// ─── Activities ───

export type ActivityUnit = 'minutes' | 'reps' | 'km' | 'pages' | 'liters' | 'count' | 'boolean'

export interface Activity {
  id: string
  user_id: string
  category_id: string
  name: string
  icon: string
  color: string
  unit: ActivityUnit
  daily_target: number | null
  is_active: boolean
  sort_order: number
}

// ─── Activity Logs ───

export interface StrengthSet {
  reps: number
  weight: number
  rpe?: number
}

export interface ActivityLog {
  id: string
  user_id: string
  activity_id: string
  logged_date: string // YYYY-MM-DD
  duration_minutes: number | null
  quantity: number | null
  intensity: number | null // 1–10
  quality: number | null // 1–5
  difficulty: number | null // 1–10
  mood_score: number | null // 1–10
  notes: string | null
  extra_data: Record<string, unknown> | null
  created_at: string
}

// ─── Stats ───

export interface DayActivity {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
}

export interface Streak {
  activity_id: string
  activity_name: string
  current_streak: number
  longest_streak: number
  weekly_consistency_score: number
}

export interface PersonalRecord {
  id: string
  activity_id: string
  activity_name: string
  record_type: 'weight' | 'reps' | 'volume' | 'e1rm' | 'duration' | 'distance'
  value: number
  logged_date: string
}

export interface DashboardSummary {
  active_days_this_month: number
  total_sessions: number
  top_activity: string | null
  current_longest_streak: number
}

export interface CorrelationInsight {
  factor: string
  metric: string
  delta: number
  description: string
}

export interface LogCreated extends ActivityLog {
  new_records: string[]
}

export type LogInput = {
  activity_id: string
  logged_date: string
  duration_minutes?: number | null
  quantity?: number | null
  intensity?: number | null
  quality?: number | null
  difficulty?: number | null
  mood_score?: number | null
  notes?: string | null
  extra_data?: Record<string, unknown> | null
}

export interface PresetActivity {
  category_id: string
  category_slug: CategorySlug
  name: string
  icon: string
  color: string
  unit: ActivityUnit
  daily_target: number | null
}

export interface Correlations {
  mood_days: number
  required_days: number
  insights: CorrelationInsight[]
}

export interface Profile {
  id: string
  display_name: string | null
  username: string | null
  avatar_url: string | null
  timezone: string
}
