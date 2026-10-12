export const ALL_ZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
})()

export const POPULAR = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Calcutta',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]

/** Common places people search for that aren't IANA zone names. */
export const ALIASES: Record<string, string> = {
  boston: 'America/New_York', 'new york': 'America/New_York', nyc: 'America/New_York', miami: 'America/New_York',
  atlanta: 'America/New_York', washington: 'America/New_York', philadelphia: 'America/New_York', eastern: 'America/New_York',
  est: 'America/New_York', edt: 'America/New_York', austin: 'America/Chicago', dallas: 'America/Chicago',
  houston: 'America/Chicago', central: 'America/Chicago', cst: 'America/Chicago', seattle: 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles', pacific: 'America/Los_Angeles', pst: 'America/Los_Angeles',
  pdt: 'America/Los_Angeles', mountain: 'America/Denver', india: 'Asia/Kolkata', ist: 'Asia/Kolkata',
  chennai: 'Asia/Kolkata', mumbai: 'Asia/Kolkata', bangalore: 'Asia/Kolkata', bengaluru: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata', hyderabad: 'Asia/Kolkata', uk: 'Europe/London', gmt: 'Europe/London',
}

export interface ZoneInfo {
  id: string
  city: string
  region: string
  offset: string
  offsetMinutes: number
  time: string
}

export function describe(id: string, now: Date): ZoneInfo {
  const parts = id.split('/')
  const city = (parts[parts.length - 1] ?? id).replace(/_/g, ' ')
  const region = parts.length > 1 ? parts.slice(0, -1).join(' / ').replace(/_/g, ' ') : ''
  let offset = 'UTC'
  let time = ''
  let offsetMinutes = 0
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: id, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find((p) => p.type === 'timeZoneName')?.value
    offset = !name || name === 'GMT' ? 'UTC' : name.replace('GMT', 'UTC').replace('-', '−')
    const m = /([+-])(\d{2}):?(\d{2})?/.exec(name ?? '')
    if (m) offsetMinutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0))
    time = now.toLocaleTimeString(undefined, { timeZone: id, hour: 'numeric', minute: '2-digit' })
  } catch {
    /* unknown zone in this browser */
  }
  return { id, city, region, offset, offsetMinutes, time }
}

/** Friendly one-line label, e.g. "New York · UTC−04:00". */
export function zoneLabel(id: string): string {
  const z = describe(id, new Date())
  return `${z.city} · ${z.offset}`
}

