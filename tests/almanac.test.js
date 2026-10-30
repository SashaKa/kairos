import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayForecast, tithiGroup } from '../src/calc/almanac.js';
import { parseYmd } from '../src/calc/tz.js';

const TZ = 'Europe/Belgrade';

test('day officer, day spirit, clash and direction (checked against the almanac readings)', () => {
  const rows = [
    // date, officer, spirit, clash, direction
    ['2026-10-02', '建', '玉堂', '卯', 'east'],
    ['2026-10-14', '闭', null, '卯', 'east'],
    ['2026-10-15', '建', null, '辰', 'north'],
    ['2026-10-16', '除', '玉堂', '巳', 'west'],
    ['2026-10-17', '满', '天牢', '午', 'south'],
    ['2026-10-25', '开', '金匮', '寅', 'south'],
    ['2026-10-28', '除', '玉堂', '巳', 'west'],
    ['2026-10-29', '满', '天牢', '午', 'south'],
    ['2026-10-30', '平', '玄武', '未', 'east'],
    ['2026-10-31', '定', '司命', '申', 'north'],
  ];
  for (const [d, off, sp, clash, dir] of rows) {
    const f = dayForecast(parseYmd(d), TZ);
    assert.equal(f.officer, off, `${d} officer`);
    if (sp) assert.equal(f.spirit, sp, `${d} spirit`);
    assert.equal(f.clashBranch, clash, `${d} clash`);
    assert.equal(f.shaDirection, dir, `${d} direction`);
  }
});

test('solar term day already belongs to the new month (寒露 08.10.2026 repeats 执)', () => {
  assert.equal(dayForecast(parseYmd('2026-10-07'), TZ).officer, '执');
  assert.equal(dayForecast(parseYmd('2026-10-08'), TZ).officer, '执');
  assert.equal(dayForecast(parseYmd('2026-10-08'), TZ).monthBranch, '戌');
});

test('tithi groups', () => {
  assert.equal(tithiGroup(4), 'rikta');
  assert.equal(tithiGroup(5), 'purna');
  assert.equal(tithiGroup(6), 'nanda');
  assert.equal(tithiGroup(18), 'jaya');
  assert.equal(tithiGroup(20), 'purna');
});
