// Badge spec and gradient utilities shared between badges page and completion page

export interface BadgeGradient {
  from: string
  to: string
  text: string
}

const BADGE_GRADIENTS: BadgeGradient[] = [
  { from: '#1a2744', to: '#4a90c4', text: '#ffffff' },
  { from: '#7bb8e0', to: '#4a9ad4', text: '#ffffff' },
  { from: '#a8d4f0', to: '#d4e8f7', text: '#1a2744' },
  { from: '#ff8c5a', to: '#d73027', text: '#ffffff' },
  { from: '#4a9ad4', to: '#1a2744', text: '#ffffff' },
  { from: '#d4e8f7', to: '#7bb8e0', text: '#1a2744' },
]

export function badgeGradient(name: string, index: number): BadgeGradient {
  // Stable gradient based on name hash + index fallback
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return BADGE_GRADIENTS[(hash + index) % BADGE_GRADIENTS.length]
}

export interface BadgeSpec {
  emoji: string
  description: string
}

const BADGE_SPECS: Record<string, BadgeSpec> = {
  'first_step':        { emoji: '🚀', description: 'Completed your first step' },
  'fast_learner':      { emoji: '⚡', description: 'Completed 5 steps in a week' },
  'streak_7':          { emoji: '🔥', description: '7-day learning streak' },
  'streak_30':         { emoji: '💎', description: '30-day learning streak' },
  'halfway':           { emoji: '🏅', description: 'Completed 50% of the course' },
  'course_complete':   { emoji: '🏆', description: 'Completed the full course' },
  'perfect_score':     { emoji: '⭐', description: 'Achieved a perfect score' },
  'early_bird':        { emoji: '🌅', description: 'Submitted before 8am' },
  'night_owl':         { emoji: '🦉', description: 'Submitted after midnight' },
  'consistent':        { emoji: '📈', description: '10 consecutive submissions' },
}

export function getBadgeSpec(name: string): BadgeSpec {
  const key = name.toLowerCase().replace(/\s+/g, '_')
  return BADGE_SPECS[key] ?? { emoji: '🎖️', description: name }
}
