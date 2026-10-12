"""Preset activities offered during onboarding / in the activity manager.

Activities belong to a user, so presets are a static catalogue that gets copied
into the user's activities when they pick one.
"""

PRESET_ACTIVITIES: list[dict] = [
    # Workout
    {"category": "workout", "name": "Strength Training", "icon": "🏋️", "color": "#ef4444", "unit": "minutes", "daily_target": None},
    {"category": "workout", "name": "Running", "icon": "🏃", "color": "#f97316", "unit": "km", "daily_target": 5},
    {"category": "workout", "name": "Cycling", "icon": "🚴", "color": "#f43f5e", "unit": "km", "daily_target": None},
    {"category": "workout", "name": "Yoga", "icon": "🧘", "color": "#ec4899", "unit": "minutes", "daily_target": 20},
    {"category": "workout", "name": "HIIT", "icon": "🔥", "color": "#dc2626", "unit": "minutes", "daily_target": 20},
    {"category": "workout", "name": "Walking", "icon": "🚶", "color": "#fb923c", "unit": "count", "daily_target": 8000},
    # Habits
    {"category": "habit", "name": "Meditation", "icon": "🧠", "color": "#3b82f6", "unit": "minutes", "daily_target": 10},
    {"category": "habit", "name": "Reading", "icon": "📚", "color": "#6366f1", "unit": "pages", "daily_target": 20},
    {"category": "habit", "name": "Sleep", "icon": "😴", "color": "#1d4ed8", "unit": "count", "daily_target": 8},
    {"category": "habit", "name": "Water", "icon": "💧", "color": "#0ea5e9", "unit": "liters", "daily_target": 2},
    {"category": "habit", "name": "Cold Shower", "icon": "🚿", "color": "#06b6d4", "unit": "boolean", "daily_target": None},
    {"category": "habit", "name": "Journaling", "icon": "✍️", "color": "#2563eb", "unit": "count", "daily_target": 200},
    # Skill practice
    {"category": "skill", "name": "Coding Practice", "icon": "💻", "color": "#a855f7", "unit": "minutes", "daily_target": 30},
    {"category": "skill", "name": "Language Learning", "icon": "🗣️", "color": "#9333ea", "unit": "minutes", "daily_target": 15},
    {"category": "skill", "name": "Music Practice", "icon": "🎸", "color": "#c026d3", "unit": "minutes", "daily_target": 30},
    {"category": "skill", "name": "Drawing", "icon": "🎨", "color": "#d946ef", "unit": "minutes", "daily_target": None},
    # Mood
    {"category": "mood", "name": "Mood Check-in", "icon": "😊", "color": "#f59e0b", "unit": "boolean", "daily_target": None},
    {"category": "mood", "name": "Gratitude", "icon": "🙏", "color": "#eab308", "unit": "count", "daily_target": 3},
]
