// Day forecast data that follows from fixed almanac rules (no personal chart).
import * as A from '../../vendor/astronomy.js';
import { dayPillar, BRANCHES, SPIRITS, SPIRIT_GOOD } from './chinese.js';
import { zonedToUtc, addDays } from './tz.js';

// 12 day officers (建除十二神): index = (day branch − month branch) mod 12.
export const OFFICERS = ['建', '除', '满', '平', '定', '执', '破', '危', '成', '收', '开', '闭'];

// Day spirit (yellow/black road): 青龙 day branch by month branch.
const DRAGON_DAY = { 寅: 0, 申: 0, 卯: 2, 酉: 2, 辰: 4, 戌: 4, 巳: 6, 亥: 6, 子: 8, 午: 8, 丑: 10, 未: 10 };

// Peng Zu's hundred taboos (彭祖百忌): keys into i18n.
export const PENGZU_STEM = '甲乙丙丁戊己庚辛壬癸'.split('');
export const PENGZU_BRANCH = BRANCHES;

// Inauspicious direction (煞方) by day branch triad.
const SHA = { 申: 'south', 子: 'south', 辰: 'south', 寅: 'north', 午: 'north', 戌: 'north', 巳: 'east', 酉: 'east', 丑: 'east', 亥: 'west', 卯: 'west', 未: 'west' };

/** Sun's apparent ecliptic longitude, degrees. */
export function sunLongitude(date) {
  return A.SunPosition(date).elon;
}

/**
 * Month branch by solar terms (节): 立春 at 315° starts 寅.
 * The day on which a term falls already belongs to the new month,
 * so the Sun is taken at the end of the civil day.
 */
export function monthBranchIdx(endOfDay) {
  const lon = sunLongitude(endOfDay);
  return (Math.floor((((lon - 315) % 360) + 360) % 360 / 30) + 2) % 12;
}

/** Tithi five-fold group: nanda, bhadra, jaya, rikta, purna. */
export function tithiGroup(tithi) {
  return ['nanda', 'bhadra', 'jaya', 'rikta', 'purna'][(tithi - 1) % 5];
}

/** Forecast facts for civil date `ymd` in zone `tz`. */
export function dayForecast(ymd, tz) {
  const day = dayPillar(ymd);
  const next = addDays(ymd, 1);
  const endOfDay = zonedToUtc(next.y, next.m, next.d, 0, 0, tz);
  const mb = monthBranchIdx(new Date(endOfDay.getTime() - 1000));
  const db = BRANCHES.indexOf(day.branch);
  const officerIdx = ((db - mb) % 12 + 12) % 12;
  const spiritIdx = ((db - DRAGON_DAY[BRANCHES[mb]]) % 12 + 12) % 12;
  const weekday = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay(); // 0 = Sunday
  return {
    day,
    monthBranch: BRANCHES[mb],
    officer: OFFICERS[officerIdx], officerIdx,
    spirit: SPIRITS[spiritIdx], spiritIdx, spiritGood: SPIRIT_GOOD[spiritIdx],
    pengzuStem: day.stem, pengzuBranch: day.branch,
    clashBranch: BRANCHES[(db + 6) % 12], clashIdx: (db + 6) % 12,
    shaDirection: SHA[day.branch],
    weekday,
  };
}

/** Link to the Tibetan almanac page (tibetastromed.ru) for a date. */
export function tibetAlmanacUrl({ y, m, d }, lang) {
  const p = n => String(n).padStart(2, '0');
  return `https://tibetastromed.ru/docom.php?tdat=${p(m)}/${p(d)}/${y}&type=new&lang=${lang === 'ru' ? 'ru' : 'en'}`;
}
