// Astronomical primitives on top of astronomy-engine (MIT).
import * as A from '../../vendor/astronomy.js';

export function observer(lat, lon) {
  return new A.Observer(lat, lon, 0);
}

/** First sunrise (upper limb, standard refraction) after `from`, within `days`. Date or null. */
export function nextSunrise(obs, from, days = 1.5) {
  const t = A.SearchRiseSet(A.Body.Sun, obs, +1, from, days);
  return t ? t.date : null;
}

export function nextSunset(obs, from, days = 1.5) {
  const t = A.SearchRiseSet(A.Body.Sun, obs, -1, from, days);
  return t ? t.date : null;
}

/** Moon−Sun geocentric ecliptic elongation, degrees [0, 360). */
export function elongation(date) {
  const moon = A.EclipticGeoMoon(date).lon;
  const sun = A.SunPosition(date).elon;
  return (((moon - sun) % 360) + 360) % 360;
}

/** Tithi 1–30 in force at an instant. */
export function tithiAt(date) {
  return Math.floor(elongation(date) / 12) + 1;
}

/**
 * True solar time minus UTC at an instant, in minutes
 * (longitude / 15 h + equation of time), from the Sun's hour angle.
 */
export function solarOffsetMinutes(obs, date) {
  const ha = A.HourAngle(A.Body.Sun, date, obs); // sidereal hours, 0..24
  const tst = (ha + 12) % 24;
  const utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  let diff = (tst - utcH) * 60;
  while (diff > 720) diff -= 1440;
  while (diff < -720) diff += 1440;
  return diff;
}
