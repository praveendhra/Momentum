/** Curated, searchable emoji set for activity icons. Each entry: [emoji, keywords]. */
export type EmojiGroup = { name: string; items: [string, string][] }

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: 'Fitness',
    items: [
      ['🏃', 'run running jog cardio'], ['🚶', 'walk walking steps'], ['🏋️', 'weights lift strength gym'], ['💪', 'muscle strength arm workout'],
      ['🚴', 'bike cycling cycle ride'], ['🏊', 'swim swimming pool'], ['🧘', 'yoga stretch meditate'], ['🤸', 'gymnastics stretch mobility'],
      ['🥊', 'boxing punch fight'], ['🥋', 'martial arts karate judo'], ['🧗', 'climb climbing boulder'], ['⛹️', 'basketball ball'],
      ['🏀', 'basketball'], ['⚽', 'soccer football'], ['🎾', 'tennis'], ['🏸', 'badminton'], ['🏓', 'table tennis ping pong'],
      ['🏐', 'volleyball'], ['🏈', 'american football'], ['⚾', 'baseball'], ['🏏', 'cricket'], ['⛳', 'golf'], ['🎳', 'bowling'],
      ['⛷️', 'ski skiing'], ['🏂', 'snowboard'], ['🏄', 'surf surfing'], ['🚣', 'row rowing'], ['🛹', 'skateboard'],
      ['🥾', 'hike hiking boots trail'], ['🤾', 'handball'], ['🏇', 'horse riding'], ['🧎', 'kneel plank core'], ['🦵', 'leg legs squat'],
      ['❤️‍🔥', 'cardio heart burn'], ['⏱️', 'timer stopwatch interval hiit'],
    ],
  },
  {
    name: 'Health',
    items: [
      ['💧', 'water hydrate drink'], ['😴', 'sleep rest nap'], ['🛌', 'bed sleep'], ['🥗', 'salad healthy eat diet'], ['🍎', 'apple fruit eat'],
      ['🥦', 'vegetable broccoli veggies'], ['🍳', 'cook breakfast'], ['🥤', 'smoothie shake protein'], ['🍵', 'tea green'], ['☕', 'coffee caffeine'],
      ['🚭', 'no smoking quit'], ['🚱', 'no alcohol sober'], ['💊', 'vitamin pill medicine supplement'], ['🦷', 'teeth floss dental'],
      ['🧴', 'skincare lotion'], ['🚿', 'shower cold'], ['🛀', 'bath'], ['🌞', 'sun sunlight morning'], ['🌙', 'night evening'],
      ['🫁', 'breath breathing lungs'], ['🩺', 'health checkup'], ['⚖️', 'weight scale weigh'],
    ],
  },
  {
    name: 'Mind',
    items: [
      ['🧠', 'brain meditation mind think'], ['🙏', 'gratitude thanks pray'], ['😊', 'mood happy smile'], ['📓', 'journal notebook diary'],
      ['✍️', 'write writing journal'], ['🕯️', 'calm candle relax'], ['🌿', 'nature calm plant'], ['☮️', 'peace calm'],
      ['💭', 'reflect thought'], ['🎯', 'goal focus target'], ['🧩', 'puzzle brain game'], ['♟️', 'chess strategy'],
      ['📵', 'no phone screen detox'], ['🌅', 'sunrise morning routine'], ['🫶', 'kindness love self care'], ['😌', 'relax calm'],
    ],
  },
  {
    name: 'Learning',
    items: [
      ['📚', 'read reading books study'], ['📖', 'book read'], ['🗣️', 'language speak talk'], ['🌍', 'language world travel'],
      ['💻', 'code coding programming computer'], ['⌨️', 'type keyboard code'], ['🧪', 'science experiment'], ['🔬', 'research science'],
      ['🧮', 'math abacus'], ['📝', 'notes study write'], ['🎓', 'study course school'], ['🎧', 'podcast listen audio'],
      ['📰', 'news read'], ['🗂️', 'organize files'], ['🤖', 'ai robot tech'], ['📐', 'design geometry'],
    ],
  },
  {
    name: 'Creative',
    items: [
      ['🎸', 'guitar music'], ['🎹', 'piano keyboard music'], ['🎻', 'violin music'], ['🥁', 'drums music'], ['🎤', 'sing singing voice'],
      ['🎵', 'music note practice'], ['🎨', 'paint art draw'], ['✏️', 'draw sketch pencil'], ['📷', 'photo photography camera'],
      ['🎬', 'film video edit'], ['🧶', 'knit knitting crochet'], ['🪡', 'sew sewing'], ['🪴', 'garden plant'], ['🍰', 'bake baking'],
      ['💃', 'dance dancing'], ['🎮', 'game gaming'],
    ],
  },
  {
    name: 'Life',
    items: [
      ['🧹', 'clean chores tidy'], ['🧺', 'laundry'], ['🛒', 'groceries shop'], ['💰', 'money save budget finance'], ['💸', 'spend no spend'],
      ['📈', 'invest growth progress'], ['📞', 'call family friends phone'], ['👨‍👩‍👧', 'family kids'], ['🐕', 'dog walk pet'], ['🐈', 'cat pet'],
      ['💼', 'work job career'], ['📧', 'email inbox'], ['📅', 'plan calendar schedule'], ['✅', 'done check task habit'],
      ['🛏️', 'make bed'], ['🌱', 'grow habit seed'], ['♻️', 'recycle eco'], ['🤝', 'volunteer help'], ['⛪', 'church worship'],
    ],
  },
  {
    name: 'Symbols',
    items: [
      ['⚡', 'energy power bolt'], ['🔥', 'fire streak hot'], ['⭐', 'star'], ['🌟', 'star shine'], ['🏆', 'trophy win'], ['🥇', 'medal gold first'],
      ['🚀', 'rocket launch'], ['💎', 'diamond gem'], ['❤️', 'heart love'], ['💚', 'green heart'], ['💙', 'blue heart'], ['💜', 'purple heart'],
      ['🌈', 'rainbow'], ['☀️', 'sun'], ['🌊', 'wave ocean'], ['🏔️', 'mountain'], ['⏰', 'alarm clock time'], ['🔔', 'bell reminder'],
    ],
  },
]

export const ALL_EMOJIS = EMOJI_GROUPS.flatMap((g) => g.items)
