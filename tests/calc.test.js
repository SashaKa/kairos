import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swaraDay, sunriseChannel, sideOf, currentSegment, swaraDayAt } from '../src/calc/swara.js';
import { dayPillar, chineseDay, chineseDayAt } from '../src/calc/chinese.js';
import { zonedParts, parseYmd, zonedToUtc } from '../src/calc/tz.js';

const BELGRADE = [44.82, 20.46, 'Europe/Belgrade'];
const CHERNIVTSI = [48.29, 25.94, 'Europe/Kyiv'];
const MIN = 60e3;

const hm = (date, tz) => {
  const p = zonedParts(date, tz);
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
};
const near = (date, tz, y, m, d, h, mi, tolMin, msg) => {
  const want = zonedToUtc(y, m, d, h, mi, tz);
  const diff = Math.abs(date - want) / MIN;
  assert.ok(diff <= tolMin, `${msg}: got ${hm(date, tz)}, want ${h}:${mi} (±${tolMin} min)`);
};

test('day pillars (ТЗ control list)', () => {
  const cases = {
    '2026-11-12': '庚寅', '2026-10-29': '丙子', '2026-10-28': '乙亥', '2026-07-24': '己亥',
    '2026-10-02': '己酉', '2026-10-14': '辛酉', '2026-10-16': '癸亥', '2026-10-17': '甲子',
    '2026-10-25': '壬申', '2026-10-27': '甲戌', '1986-07-24': '己巳',
  };
  for (const [d, want] of Object.entries(cases)) {
    const p = dayPillar(parseYmd(d));
    assert.equal(p.stem + p.branch, want, d);
  }
});

test('sunrise channel for all 30 tithi', () => {
  const lunarShukla = [1, 2, 3, 7, 8, 9, 13, 14, 15];
  for (let t = 1; t <= 30; t++) {
    const d = ((t - 1) % 15) + 1;
    const lunarDay = lunarShukla.includes(d);
    const want = t <= 15 ? (lunarDay ? 'lunar' : 'solar') : (lunarDay ? 'solar' : 'lunar');
    assert.equal(sunriseChannel(t), want, `tithi ${t}`);
  }
});

test('sides by sex', () => {
  assert.equal(sideOf('lunar', 'female'), 'right');
  assert.equal(sideOf('solar', 'female'), 'left');
  assert.equal(sideOf('lunar', 'male'), 'left');
  assert.equal(sideOf('solar', 'male'), 'right');
});

test('sunrise, tithi and channel (ТЗ control examples)', () => {
  const rows = [
    [BELGRADE, '2026-11-12', [6, 31], 3, 'lunar'],
    [BELGRADE, '2026-10-29', [6, 12], 19, 'lunar'],
    [BELGRADE, '2026-10-28', [6, 10], 18, 'solar'],
    [CHERNIVTSI, '2026-07-24', [5, 41], 10, 'solar'],
    [BELGRADE, '2026-07-24', [5, 15], 10, 'solar'],
  ];
  for (const [[lat, lon, tz], d, [h, mi], tithi, ch] of rows) {
    const ymd = parseYmd(d);
    const day = swaraDay(lat, lon, tz, ymd);
    assert.equal(day.polar, false);
    near(day.sunrise, tz, ymd.y, ymd.m, ymd.d, h, mi, 2, `sunrise ${d}`);
    assert.equal(day.tithi, tithi, `tithi ${d}`);
    assert.equal(day.startChannel, ch, `channel ${d}`);
  }
});

test('swara day 28–29.10.2026 Belgrade: hourly alternation and reset at sunrise', () => {
  const [lat, lon, tz] = BELGRADE;
  const day = swaraDay(lat, lon, tz, parseYmd('2026-10-28'));
  const first = day.segments[0];
  assert.equal(first.channel, 'solar');
  near(first.start, tz, 2026, 10, 28, 6, 10, 2, 'first start');
  near(first.end, tz, 2026, 10, 28, 7, 10, 2, 'first end');
  // Day is 24 h 02 min long: 24 full hours, then a 2-minute solar stub before the reset.
  assert.equal(day.segments.length, 25);
  const lastFull = day.segments.at(-2);
  assert.equal(lastFull.channel, 'lunar');
  near(lastFull.start, tz, 2026, 10, 29, 5, 10, 2, 'last full start');
  const stub = day.segments.at(-1);
  assert.equal(stub.channel, 'solar');
  near(stub.start, tz, 2026, 10, 29, 6, 10, 2, 'stub start');
  near(stub.end, tz, 2026, 10, 29, 6, 12, 2, 'stub end = next sunrise');
  const next = swaraDay(lat, lon, tz, parseYmd('2026-10-29'));
  assert.equal(next.segments[0].channel, 'lunar', 'reset by the new tithi, no smoothing');
  assert.equal(next.sunrise.getTime(), day.nextSunrise.getTime());
});

test('current segment before sunrise belongs to the previous swara day', () => {
  const [lat, lon, tz] = BELGRADE;
  const now = zonedToUtc(2026, 10, 29, 5, 30, tz);
  const day = swaraDayAt(lat, lon, tz, now);
  assert.equal(day.ymd.d, 28);
  const cur = currentSegment(day, now);
  assert.equal(cur.segment.channel, 'lunar');
  assert.equal(cur.next.channel, 'solar');
});

test('Chinese hours of day 乙亥, Belgrade (boundary 23:00 true solar time)', () => {
  const [lat, lon, tz] = BELGRADE;
  const cd = chineseDay(lat, lon, parseYmd('2026-10-28'), 'zi');
  assert.ok(Math.abs(cd.offsetMin - 60 - 38) <= 1, `offset ${cd.offsetMin}`);
  const want = [
    ['丙子', '白虎', false], ['丁丑', '玉堂', true], ['戊寅', '天牢', false], ['己卯', '玄武', false],
    ['庚辰', '司命', true], ['辛巳', '勾陈', false], ['壬午', '青龙', true], ['癸未', '明堂', true],
    ['甲申', '天刑', false], ['乙酉', '朱雀', false], ['丙戌', '金匮', true], ['丁亥', '天德', true],
  ];
  cd.hours.forEach((h, i) => {
    assert.equal(h.stem + h.branch, want[i][0]);
    assert.equal(h.spirit, want[i][1]);
    assert.equal(h.good, want[i][2], want[i][0]);
  });
  assert.equal(cd.hours[5].clash, true, '巳 clashes with 亥 day');
  near(cd.hours[0].start, tz, 2026, 10, 27, 22, 22, 2, '子 start');
  near(cd.hours[6].start, tz, 2026, 10, 28, 10, 22, 2, '午 start');
  near(cd.hours[11].end, tz, 2026, 10, 28, 22, 22, 2, '亥 end');
});

test('next day 丙子 starts at 22:22 with hour 戊子 / 金匮; midnight boundary keeps 白虎', () => {
  const [lat, lon, tz] = BELGRADE;
  const at = zonedToUtc(2026, 10, 28, 22, 40, tz);
  const zi = chineseDayAt(lat, lon, at, 'zi');
  assert.equal(zi.day.stem + zi.day.branch, '丙子');
  assert.equal(zi.current.stem + zi.current.branch, '戊子');
  assert.equal(zi.current.spirit, '金匮');
  const mid = chineseDayAt(lat, lon, at, 'midnight');
  assert.equal(mid.day.stem + mid.day.branch, '乙亥');
  assert.equal(mid.current.spirit, '白虎');
  assert.equal(mid.current.stem + mid.current.branch, '丙子');
});

test('DST switches in Belgrade (29.03.2026, 25.10.2026)', () => {
  const [lat, lon, tz] = BELGRADE;
  for (const d of ['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25']) {
    const day = swaraDay(lat, lon, tz, parseYmd(d));
    assert.equal(day.polar, false, d);
    const len = (day.nextSunrise - day.sunrise) / MIN;
    assert.ok(len > 23 * 60 && len < 25 * 60, `${d} day length ${len}`);
    // Every segment is 60 real minutes except the last one.
    day.segments.slice(0, -1).forEach(s => assert.equal((s.end - s.start) / MIN, 60));
  }
  // Sunrise clock time jumps by ~1 h across the switch.
  const a = swaraDay(lat, lon, tz, parseYmd('2026-03-28')).sunrise;
  const b = swaraDay(lat, lon, tz, parseYmd('2026-03-29')).sunrise;
  const pa = zonedParts(a, tz), pb = zonedParts(b, tz);
  const diff = (pb.h * 60 + pb.mi) - (pa.h * 60 + pa.mi);
  assert.ok(diff > 55 && diff < 62, `clock sunrise shift ${diff}`);
});

test('polar night: channels impossible, Chinese hours still work', () => {
  const day = swaraDay(69.65, 18.96, 'Europe/Oslo', parseYmd('2026-12-20'));
  assert.equal(day.polar, true);
  const cd = chineseDay(69.65, 18.96, parseYmd('2026-12-20'));
  assert.equal(cd.hours.length, 12);
});

test('period setting: 90 minutes', () => {
  const [lat, lon, tz] = BELGRADE;
  const day = swaraDay(lat, lon, tz, parseYmd('2026-10-28'), 90);
  assert.equal((day.segments[0].end - day.segments[0].start) / MIN, 90);
  assert.equal(day.segments[1].channel, 'lunar');
});
