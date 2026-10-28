// Chinese double-hours (shichen) on true solar time, day/hour pillars and hour spirits.
import { observer, solarOffsetMinutes } from './astro.js';
import { jdn, addDays } from './tz.js';

export const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
export const SPIRITS = ['青龙', '明堂', '天刑', '朱雀', '金匮', '天德', '白虎', '玉堂', '天牢', '玄武', '司命', '勾陈'];
export const SPIRIT_GOOD = [true, true, false, false, true, true, false, true, false, false, true, false];

// Branch of the hour where 青龙 stands, by day branch.
const DRAGON_START = { 寅: 0, 申: 0, 卯: 2, 酉: 2, 辰: 4, 戌: 4, 巳: 6, 亥: 6, 子: 8, 午: 8, 丑: 10, 未: 10 };
// Stem of the 子 hour, by day stem.
const ZI_STEM = { 甲: 0, 己: 0, 乙: 2, 庚: 2, 丙: 4, 辛: 4, 丁: 6, 壬: 6, 戊: 8, 癸: 8 };

/** Sexagenary day pillar for a civil date: index 0 = 甲子. */
export function dayPillar(ymd) {
  const i = ((jdn(ymd) + 49) % 60 + 60) % 60;
  return { index: i, stem: STEMS[i % 10], branch: BRANCHES[i % 12] };
}

/** Hour info for branch index 0..11 within a day pillar. */
export function hourOf(day, branchIdx) {
  const stem = STEMS[(ZI_STEM[day.stem] + branchIdx) % 10];
  const branch = BRANCHES[branchIdx];
  const spiritIdx = ((branchIdx - DRAGON_START[day.branch]) % 12 + 12) % 12;
  const clash = (BRANCHES.indexOf(day.branch) + 6) % 12 === branchIdx;
  const good = SPIRIT_GOOD[spiritIdx] && !clash;
  return { stem, branch, branchIdx, spirit: SPIRITS[spiritIdx], spiritIdx, spiritGood: SPIRIT_GOOD[spiritIdx], clash, good };
}

/**
 * The 12 (or 13 with a midnight boundary) hours of the Chinese day labelled `ymd`.
 * boundary: 'zi' — day starts at 23:00 true solar time of the previous date; 'midnight' — at 00:00.
 * Real instants come from the true-solar offset at local solar noon of that date.
 */
export function chineseDay(lat, lon, ymd, boundary = 'zi') {
  const obs = observer(lat, lon);
  // Approximate solar noon: 12:00 UTC shifted by longitude.
  const noonGuess = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 12) - (lon / 15) * 3600e3);
  const offsetMin = solarOffsetMinutes(obs, noonGuess);
  const tstToReal = tstMs => new Date(tstMs - offsetMin * 60e3);
  const day = dayPillar(ymd);
  const base = Date.UTC(ymd.y, ymd.m - 1, ymd.d); // 00:00 TST of the date
  const H = 3600e3;
  const hours = [];
  if (boundary === 'zi') {
    for (let b = 0; b < 12; b++) {
      const s = base - H + b * 2 * H;
      hours.push({ ...hourOf(day, b), start: tstToReal(s), end: tstToReal(s + 2 * H) });
    }
  } else {
    hours.push({ ...hourOf(day, 0), start: tstToReal(base), end: tstToReal(base + H), part: 'late' });
    for (let b = 1; b < 12; b++) {
      const s = base - H + b * 2 * H;
      hours.push({ ...hourOf(day, b), start: tstToReal(s), end: tstToReal(s + 2 * H) });
    }
    hours.push({ ...hourOf(day, 0), start: tstToReal(base + 23 * H), end: tstToReal(base + 24 * H), part: 'early' });
  }
  return { ymd, day, offsetMin, boundary, start: hours[0].start, end: hours[hours.length - 1].end, hours };
}

/** Label date of the Chinese day containing `now`. */
export function chineseDayAt(lat, lon, now, boundary = 'zi') {
  const obs = observer(lat, lon);
  const off = solarOffsetMinutes(obs, now);
  const tst = new Date(now.getTime() + off * 60e3);
  let ymd = { y: tst.getUTCFullYear(), m: tst.getUTCMonth() + 1, d: tst.getUTCDate() };
  if (boundary === 'zi' && tst.getUTCHours() >= 23) ymd = addDays(ymd, 1);
  let cd = chineseDay(lat, lon, ymd, boundary);
  // Guard against the small drift of the offset across the day.
  if (now < cd.start) cd = chineseDay(lat, lon, addDays(ymd, -1), boundary);
  else if (now >= cd.end) cd = chineseDay(lat, lon, addDays(ymd, 1), boundary);
  const current = cd.hours.find(h => now >= h.start && now < h.end) || null;
  return { ...cd, current, tst };
}
