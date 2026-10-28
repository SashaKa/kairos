// Swara (breath channel) day: from sunrise to the next sunrise.
import { observer, nextSunrise, nextSunset, tithiAt } from './astro.js';
import { zonedToUtc, ymdOf, addDays } from './tz.js';

export const SOLAR = 'solar';
export const LUNAR = 'lunar';

const LUNAR_FIRST_DAYS = new Set([1, 2, 3, 7, 8, 9, 13, 14, 15]);

/** Half of the month and day within it for tithi 1–30. */
export function pakshaOf(tithi) {
  return {
    paksha: tithi <= 15 ? 'shukla' : 'krishna',
    dayInHalf: ((tithi - 1) % 15) + 1,
  };
}

/** Channel at sunrise for a tithi (Shiva Swarodaya rule). */
export function sunriseChannel(tithi) {
  const { paksha, dayInHalf } = pakshaOf(tithi);
  const lunarDay = LUNAR_FIRST_DAYS.has(dayInHalf);
  if (paksha === 'shukla') return lunarDay ? LUNAR : SOLAR;
  return lunarDay ? SOLAR : LUNAR;
}

export function opposite(ch) {
  return ch === SOLAR ? LUNAR : SOLAR;
}

/** Nostril side of a channel for the chosen sex (per the author's Kalachakra notes). */
export function sideOf(channel, sex) {
  if (sex === 'male') return channel === SOLAR ? 'right' : 'left';
  return channel === SOLAR ? 'left' : 'right';
}

/**
 * Swara day that starts at the sunrise of local date `ymd` in zone `tz`.
 * Returns { polar: true } when there is no sunrise/next sunrise.
 */
export function swaraDay(lat, lon, tz, ymd, periodMin = 60) {
  const obs = observer(lat, lon);
  const midnight = zonedToUtc(ymd.y, ymd.m, ymd.d, 0, 0, tz);
  const sunrise = nextSunrise(obs, midnight, 1);
  if (!sunrise || ymdOf(sunrise, tz).d !== ymd.d) return { polar: true, ymd };
  const next = nextSunrise(obs, new Date(sunrise.getTime() + 3600e3), 1.5);
  if (!next) return { polar: true, ymd };
  const sunset = nextSunset(obs, sunrise, 1);

  const tithi = tithiAt(sunrise);
  const { paksha, dayInHalf } = pakshaOf(tithi);
  const start = sunriseChannel(tithi);

  const segments = [];
  const step = periodMin * 60e3;
  let ch = start;
  for (let t = sunrise.getTime(); t < next.getTime(); t += step) {
    segments.push({ start: new Date(t), end: new Date(Math.min(t + step, next.getTime())), channel: ch });
    ch = opposite(ch);
  }
  return { polar: false, ymd, sunrise, sunset, nextSunrise: next, tithi, paksha, dayInHalf, startChannel: start, segments };
}

/** Swara day containing instant `now`. */
export function swaraDayAt(lat, lon, tz, now, periodMin = 60) {
  const today = ymdOf(now, tz);
  let day = swaraDay(lat, lon, tz, today, periodMin);
  if (day.polar) return day;
  if (now < day.sunrise) day = swaraDay(lat, lon, tz, addDays(today, -1), periodMin);
  return day;
}

/** Current segment and its index; also the astrological hour (ghatika, 24 min) since sunrise, 1–60. */
export function currentSegment(day, now) {
  if (day.polar) return null;
  const i = day.segments.findIndex(s => now >= s.start && now < s.end);
  if (i < 0) return null;
  const ghatika = Math.min(60, Math.floor((now - day.sunrise) / (24 * 60e3)) + 1);
  return { index: i, segment: day.segments[i], next: day.segments[i + 1] || null, ghatika };
}
