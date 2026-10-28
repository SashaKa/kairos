// Time-zone helpers built on Intl (no external data).

const fmtCache = new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date, tz) {
  const p = {};
  for (const { type, value } of fmt(tz).formatToParts(date)) p[type] = value;
  return {
    y: +p.year, m: +p.month, d: +p.day,
    h: +p.hour % 24, mi: +p.minute, s: +p.second,
  };
}

/** Offset of the zone from UTC at an instant, in minutes. */
export function tzOffsetMinutes(date, tz) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Instant for a wall-clock time in a zone (handles DST transitions). */
export function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const off1 = tzOffsetMinutes(new Date(guess), tz);
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(new Date(t), tz);
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

/** Calendar arithmetic on {y,m,d}. */
export function addDays({ y, m, d }, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function ymdOf(date, tz) {
  const { y, m, d } = zonedParts(date, tz);
  return { y, m, d };
}

export function ymdKey({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return { y, m, d };
}

/** Julian Day Number of a calendar date (proleptic Gregorian). */
export function jdn({ y, m, d }) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 2440588;
}
