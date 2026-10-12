/**
 * Motivational quotes shown on the dashboard.
 * Attributions are the commonly documented sources; well-known quotes that are
 * usually misattributed (e.g. to Einstein or Twain) are deliberately left out.
 */
export interface Quote {
  text: string
  author: string
}

export const QUOTES: Quote[] = [
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Motivation is what gets you started. Habit is what keeps you going.', author: 'Jim Ryun' },
  { text: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn' },
  { text: 'We must all suffer one of two things: the pain of discipline or the pain of regret.', author: 'Jim Rohn' },
  { text: 'What you do every day matters more than what you do once in a while.', author: 'Gretchen Rubin' },
  { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
  { text: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt' },
  { text: 'The journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'Our greatest glory is not in never falling, but in rising every time we fall.', author: 'Oliver Goldsmith' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'The best way out is always through.', author: 'Robert Frost' },
  { text: 'I am always doing that which I cannot do, in order that I may learn how to do it.', author: 'Pablo Picasso' },
  { text: 'Perseverance is not a long race; it is many short races one after the other.', author: 'Walter Elliot' },
  { text: "You miss 100% of the shots you don't take.", author: 'Wayne Gretzky' },
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Nothing will work unless you do.', author: 'Maya Angelou' },
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'A river cuts through rock not because of its power, but because of its persistence.', author: 'Jim Watkins' },
  { text: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson' },
  { text: 'Hard choices, easy life. Easy choices, hard life.', author: 'Jerzy Gregorek' },
  {
    text: "Courage doesn't always roar. Sometimes courage is the quiet voice at the end of the day saying, \"I will try again tomorrow.\"",
    author: 'Mary Anne Radmacher',
  },
  { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { text: "It's not whether you get knocked down, it's whether you get up.", author: 'Vince Lombardi' },
  { text: 'Strength does not come from winning. Your struggles develop your strengths.', author: 'Arnold Schwarzenegger' },
  { text: 'Small deeds done are better than great deeds planned.', author: 'Peter Marshall' },
  { text: 'Act as if what you do makes a difference. It does.', author: 'William James' },
  { text: 'The difference between try and triumph is just a little umph!', author: 'Marvin Phillips' },
  { text: 'Excellence is not an act, but a habit. We are what we repeatedly do.', author: 'Will Durant' },
  { text: 'Fortune favors the bold.', author: 'Virgil' },
  { text: 'Dripping water hollows out stone, not through force but through persistence.', author: 'Ovid' },
  { text: 'The man who removes a mountain begins by carrying away small stones.', author: 'Chinese proverb' },
  { text: 'Slow progress is still progress.', author: 'Proverb' },
]

/** A random quote, avoiding an immediate repeat of `exclude`. */
export function randomQuote(exclude?: Quote): Quote {
  if (QUOTES.length < 2) return QUOTES[0]
  let q: Quote
  do {
    q = QUOTES[Math.floor(Math.random() * QUOTES.length)]
  } while (exclude && q.text === exclude.text)
  return q
}
