import { swaraDay, swaraDayAt, currentSegment, sideOf } from '../calc/swara.js';
import { chineseDay, chineseDayAt } from '../calc/chinese.js';
import { ymdOf, addDays, ymdKey, parseYmd } from '../calc/tz.js';

// ---------- settings ----------
const KEY = 'kairos.settings.v1';
const DEFAULTS = {
  lang: 'auto', sex: 'female', placeMode: 'geo', place: null,
  period: 60, boundary: 'zi', hanzi: true, theme: 'auto',
};
const BELGRADE = { name: 'Belgrade, RS', lat: 44.804, lon: 20.465, tz: 'Europe/Belgrade' };

function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}
function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
}
let S = loadSettings();

// ---------- i18n ----------
let dict = {};
let lang = 'ru';
function resolveLang() {
  if (S.lang !== 'auto') return S.lang;
  return (navigator.language || 'ru').toLowerCase().startsWith('ru') ? 'ru' : 'en';
}
async function loadLang() {
  lang = resolveLang();
  const res = await fetch(`src/i18n/${lang}.json`);
  dict = await res.json();
  document.documentElement.lang = lang;
  document.title = dict['app.title'];
}
const t = (k, vars = {}) => (dict[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');

const NAMES = {
  ru: {
    stems: ['Цзя', 'И', 'Бин', 'Дин', 'У', 'Цзи', 'Гэн', 'Синь', 'Жэнь', 'Гуй'],
    branches: ['Цзы', 'Чоу', 'Инь', 'Мао', 'Чэнь', 'Сы', 'У', 'Вэй', 'Шэнь', 'Ю', 'Сюй', 'Хай'],
    animals: ['Крыса', 'Бык', 'Тигр', 'Кролик', 'Дракон', 'Змея', 'Лошадь', 'Коза', 'Обезьяна', 'Петух', 'Собака', 'Свинья'],
    spirits: ['Цинлун', 'Минтан', 'Тяньсин', 'Чжуцюэ', 'Цзиньгуй', 'Тяньдэ', 'Байху', 'Юйтан', 'Тяньлао', 'Сюаньу', 'Сымин', 'Гоучэнь'],
  },
  en: {
    stems: ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'],
    branches: ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai'],
    animals: ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'],
    spirits: ['Azure Dragon', 'Bright Hall', 'Heavenly Punishment', 'Vermilion Bird', 'Golden Casket', 'Heavenly Virtue',
      'White Tiger', 'Jade Hall', 'Heavenly Prison', 'Black Tortoise', 'Life Controller', 'Hooked Array'],
  },
};
const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const N = () => NAMES[lang];

function pillarHtml(stem, branch, big = false) {
  const lat = `${N().stems[STEMS.indexOf(stem)]}-${N().branches[BRANCHES.indexOf(branch)]}`;
  if (!S.hanzi) return `<span>${lat}</span>`;
  return `<span class="hz">${stem}${branch}</span> <span class="muted ${big ? '' : 'small'}">${lat}</span>`;
}
function spiritText(h) {
  const name = N().spirits[h.spiritIdx];
  return S.hanzi ? `<span class="hz">${h.spirit}</span> ${name}` : name;
}
function ratingBadge(h) {
  return h.good
    ? `<span class="badge good">${t('cn.good')}</span>`
    : `<span class="badge bad">${t('cn.bad')}</span>`;
}

// ---------- formatting ----------
let timeFmt;
function setFormatters() {
  timeFmt = new Intl.DateTimeFormat(lang, { timeZone: place().tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
const hm = d => timeFmt.format(new Date(Math.round(d / 60e3) * 60e3));
/** Calendar date as "1 октября 2003" / "1 October 2003". */
function longDate({ y, m, d }) {
  const parts = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
    .formatToParts(new Date(Date.UTC(y, m - 1, d)));
  const get = type => parts.find(x => x.type === type)?.value ?? '';
  return `${get('day')} ${get('month')} ${get('year')}`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function countdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = n => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

// ---------- place ----------
let geoStatus = '';
const place = () => S.place || BELGRADE;
function locate() {
  if (!('geolocation' in navigator)) { geoStatus = 'failed'; render(); return; }
  geoStatus = 'waiting';
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    S.place = {
      name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    geoStatus = '';
    saveSettings(); setFormatters(); invalidate(); render();
  }, () => { geoStatus = 'failed'; render(); }, { maximumAge: 6 * 3600e3, timeout: 15000 });
}

// ---------- calculations (memoised per minute) ----------
let cache = {};
function invalidate() { cache = {}; }
function memo(key, fn) { return key in cache ? cache[key] : (cache[key] = fn()); }
function calcNow(now) {
  const p = place();
  const minute = Math.floor(now / 60e3);
  const day = memo(`sw-now-${minute}`, () => swaraDayAt(p.lat, p.lon, p.tz, now, S.period));
  const cn = memo(`cn-now-${minute}`, () => chineseDayAt(p.lat, p.lon, now, S.boundary));
  return { day, cn };
}
function swaraFor(ymd) {
  const p = place();
  return memo(`sw-${ymdKey(ymd)}`, () => swaraDay(p.lat, p.lon, p.tz, ymd, S.period));
}
function chineseFor(ymd) {
  const p = place();
  return memo(`cn-${ymdKey(ymd)}`, () => chineseDay(p.lat, p.lon, ymd, S.boundary));
}
function segmentsBetween(start, end, aroundYmd) {
  const out = [];
  for (const k of [-1, 0, 1]) {
    const d = swaraFor(addDays(aroundYmd, k));
    if (d.polar) continue;
    for (const s of d.segments) if (s.end > start && s.start < end) out.push(s);
  }
  return out;
}

// ---------- views ----------
const aboutLink = () => `<div class="about-row"><button class="about-link" data-go="about">ⓘ ${t('set.about')}</button></div>`;
let tab = 'now';
let prevTab = 'now';
let schedDate = null; // {y,m,d}
const view = document.getElementById('view');

function viewNow(now) {
  const { day, cn } = calcNow(now);
  const p = place();
  let html = '';
  if (geoStatus === 'waiting') html += `<p class="muted small">${t('geo.waiting')}</p>`;
  if (geoStatus === 'failed') html += `<p class="muted small">${t('geo.failed')}</p>`;

  if (day.polar) {
    html += `<div class="card"><p>${t('polar')}</p></div>`;
  } else {
    const cur = currentSegment(day, now);
    const ch = cur.segment.channel;
    const side = sideOf(ch, S.sex);
    const left = cur.segment.end - now;
    const soon = left < 60e3;
    const changeLine = cur.next ? t('change.at', { time: hm(cur.segment.end) }) : t('change.sunrise', { time: hm(day.nextSunrise) });
    html += `<section class="card ${ch}" aria-label="channel">
      <div class="channel-name">${t('ch.' + ch)}</div>
      <div class="side">${t('side.' + side)}</div>
      <div class="muted">${t('ch.' + ch + '.meaning')}</div>
      <div class="countdown" id="cd">${countdown(left)}</div>
      <div class="row"><span>${t('until')} · ${changeLine}</span></div>
      <p style="margin-top:10px"><strong>${t('favourable')}:</strong> ${t('ch.' + ch + '.do')}</p>
      <p class="small ${soon ? 'transition-now' : 'muted'}">${soon ? t('transition') + ': ' : ''}${t('transition.hint')}</p>
      <p class="small muted">${t('norm')}</p>
      <p class="small"><button class="about-link" data-go="about" data-anchor="units">${t('ghatika', { n: cur.ghatika })}</button></p>
    </section>`;
  }

  const h = cn.current;
  if (h) {
    html += `<section class="card link" data-go="chinese">
      <div class="row"><strong>${t('cn.hour')}</strong>${ratingBadge(h)}</div>
      <div style="font-size:26px;font-weight:700;margin-top:4px">${pillarHtml(h.stem, h.branch)}</div>
      <div>${spiritText(h)} · ${t('cn.until', { time: hm(h.end) })}</div>
      ${h.clash ? `<div class="bad small">${t('cn.clash')}</div>` : ''}
    </section>`;
  }

  html += `<section class="card"><dl class="kv">
    <dt>${t('date')}</dt><dd>${longDate(ymdOf(now, p.tz))}</dd>
    ${!day.polar ? `<dt>☾</dt><dd>${t('tithi.day', { t: day.tithi, d: day.dayInHalf, half: t('half.' + day.paksha) })}</dd>` : ''}
    <dt>${t('day.pillar')}</dt><dd>${pillarHtml(cn.day.stem, cn.day.branch)}</dd>
    ${!day.polar ? `<dt>${t('sunrise')}</dt><dd>${hm(day.sunrise)}</dd>` : ''}
    ${!day.polar && day.sunset ? `<dt>${t('sunset')}</dt><dd>${hm(day.sunset)}</dd>` : ''}
    <dt>${t('place')}</dt><dd>${esc(p.name)}</dd>
  </dl>${aboutLink()}</section>`;
  return html;
}

function viewChinese(now) {
  const { cn } = calcNow(now);
  const h = cn.current;
  const clockOff = Math.round(cn.offsetMin - tzOffsetAt(now));
  const segs = segmentsBetween(cn.start, cn.end, cn.ymd);
  let html = `<section class="card">
    <div class="row"><strong>${t('cn.hour')}</strong>${h ? ratingBadge(h) : ''}</div>
    ${h ? `<div class="big-pillar">${pillarHtml(h.stem, h.branch, true)}</div>
    <div>${N().animals[h.branchIdx]} · ${spiritText(h)}</div>
    <div>${hm(h.start)}–${hm(h.end)} · ${t('cn.until', { time: hm(h.end) })}</div>
    ${h.clash ? `<div class="bad">${t('cn.clash')}</div>` : ''}` : ''}
  </section>
  <section class="card"><dl class="kv">
    <dt>${t('day.pillar')}</dt><dd>${pillarHtml(cn.day.stem, cn.day.branch)}</dd>
  </dl>
  <p class="small muted" style="margin-top:8px">${t('cn.offset', { sign: clockOff >= 0 ? '+' : '−', min: Math.abs(clockOff) })}. ${t('cn.boundary.' + cn.boundary)}.</p>
  </section>
  <section class="card"><ul class="list">${hourRows(cn, segs, now)}</ul>
  <p class="small muted" style="margin-top:8px">${t('cn.compare')} <span class="dot solar"></span> ${t('ch.solar')} <span class="dot lunar"></span> ${t('ch.lunar')}</p></section>`;
  return html;
}

function tzOffsetAt(date) {
  // Offset of the place's zone from UTC, minutes.
  const p = place();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: p.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    .formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
  return Math.round((asUtc - Math.floor(date / 60e3) * 60e3) / 60e3);
}

function hourRows(cn, segs, now) {
  return cn.hours.map(h => {
    const cur = now && now >= h.start && now < h.end;
    const dots = segs.filter(s => s.end > h.start && s.start < h.end).map(s => `<span class="dot ${s.channel}" title="${t('ch.' + s.channel)}"></span>`).join('');
    const part = h.part ? ` <span class="muted small">${t('cn.part.' + h.part)}</span>` : '';
    return `<li class="${cur ? 'current' : ''}">
      <span class="time">${hm(h.start)}–${hm(h.end)}</span>
      <span>${pillarHtml(h.stem, h.branch)}${part}<br><span class="small">${spiritText(h)}${h.clash ? ` · <span class="bad">${t('cn.clash')}</span>` : ''}</span></span>
      <span class="${h.good ? 'good' : 'bad'}" style="text-align:right">${h.good ? '●' : '○'}<br><span class="dots">${dots}</span></span>
    </li>`;
  }).join('');
}

function viewSchedule(now) {
  const p = place();
  const today = ymdOf(now, p.tz);
  const d = schedDate || today;
  const day = swaraFor(d);
  const cn = chineseFor(d);
  const key = ymdKey(d);
  const btn = (label, ymd) => `<button data-date="${ymdKey(ymd)}" aria-pressed="${ymdKey(ymd) === key}">${label}</button>`;
  let html = `<div class="seg">
    ${btn(t('sch.yesterday'), addDays(today, -1))}${btn(t('sch.today'), today)}${btn(t('sch.tomorrow'), addDays(today, 1))}
    <span class="datepick"><button id="datePick" type="button">${longDate(d)}</button><input type="date" id="dateInput" value="${key}" aria-label="${t('sch.date')}" tabindex="-1"></span>
  </div>`;
  html += `<section class="card"><h2>${t('sch.channels')}</h2>`;
  if (day.polar) html += `<p>${t('polar')}</p>`;
  else {
    html += `<p class="small muted">${t('tithi.day', { t: day.tithi, d: day.dayInHalf, half: t('half.' + day.paksha) })} · ${t('sunrise')} ${hm(day.sunrise)}</p><ul class="list">`;
    html += day.segments.map(s => {
      const cur = now >= s.start && now < s.end;
      return `<li class="${cur ? 'current' : ''}"><span class="time">${hm(s.start)}–${hm(s.end)}</span>
        <span class="${s.channel}-ink">${t('ch.' + s.channel)}</span>
        <span class="small muted">${t('side.' + sideOf(s.channel, S.sex))}</span></li>`;
    }).join('');
    html += `</ul>`;
  }
  html += `</section><section class="card"><h2>${t('sch.chinese')}</h2>
    <p class="small muted">${t('day.pillar')}: ${pillarHtml(cn.day.stem, cn.day.branch)}</p>
    <ul class="list">${hourRows(cn, segmentsBetween(cn.start, cn.end, d), now)}</ul></section>`;
  return html;
}

let cityData = null;
async function loadCities() {
  if (!cityData) cityData = await (await fetch('data/cities.json')).json();
  return cityData;
}
function viewSettings() {
  const p = place();
  const opt = (name, value, label) => `<button data-set="${name}" data-value="${value}" aria-pressed="${String(S[name]) === String(value)}">${label}</button>`;
  const periods = []; for (let m = 60; m <= 180; m += 15) periods.push(m);
  let tzs = [];
  try { tzs = Intl.supportedValuesOf('timeZone'); } catch { tzs = [p.tz]; }
  return `<section class="card">
    <label>${t('set.language')}</label>
    <div class="seg">${opt('lang', 'auto', t('set.language.auto'))}${opt('lang', 'ru', 'Русский')}${opt('lang', 'en', 'English')}</div>
    <label>${t('set.sex')}</label>
    <div class="seg">${opt('sex', 'female', t('set.sex.female'))}${opt('sex', 'male', t('set.sex.male'))}</div>
    <p class="small muted">${t('set.sex.note')}</p>
  </section>
  <section class="card">
    <label>${t('set.place')}: <strong style="color:var(--ink)">${esc(p.name)}</strong> <span class="small">(${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}, ${esc(p.tz)})</span></label>
    <div class="seg">${opt('placeMode', 'geo', t('set.place.geo'))}${opt('placeMode', 'city', t('set.place.city'))}${opt('placeMode', 'manual', t('set.place.manual'))}</div>
    ${S.placeMode === 'geo' ? `<button class="chip" id="locate">${t('set.place.locate')}</button>` : ''}
    ${S.placeMode === 'city' ? `<input id="citySearch" type="search" autocomplete="off" placeholder="${t('set.place.search')}"><ul class="results" id="cityResults"></ul>` : ''}
    ${S.placeMode === 'manual' ? `<div class="field-row">
        <div><label for="lat">${t('set.lat')}</label><input id="lat" type="number" step="0.01" min="-90" max="90" value="${p.lat}"></div>
        <div><label for="lon">${t('set.lon')}</label><input id="lon" type="number" step="0.01" min="-180" max="180" value="${p.lon}"></div>
      </div>
      <label for="tz">${t('set.tz')}</label>
      <select id="tz">${tzs.map(z => `<option ${z === p.tz ? 'selected' : ''}>${z}</option>`).join('')}</select>
      <button class="primary" id="saveManual">${t('set.save')}</button>` : ''}
  </section>
  <section class="card">
    <label for="period">${t('set.period')}</label>
    <select id="period">${periods.map(m => `<option value="${m}" ${m === S.period ? 'selected' : ''}>${m} ${t('set.period.unit')}</option>`).join('')}</select>
    <label>${t('set.boundary')}</label>
    <div class="seg">${opt('boundary', 'zi', t('set.boundary.zi'))}${opt('boundary', 'midnight', t('set.boundary.midnight'))}</div>
    <label class="check"><input type="checkbox" id="hanzi" ${S.hanzi ? 'checked' : ''}> ${t('set.hanzi')}</label>
    <label>${t('set.theme')}</label>
    <div class="seg">${opt('theme', 'auto', t('set.theme.auto'))}${opt('theme', 'light', t('set.theme.light'))}${opt('theme', 'dark', t('set.theme.dark'))}</div>
  </section>
  <section class="card">${aboutLink()}</section>`;
}

function viewAbout() {
  return `<button class="chip" data-go="${prevTab}">← ${t('about.back')}</button>
  <section class="card about" style="margin-top:12px"><div class="table-wrap">${t('about.html')}</div></section>`;
}

// ---------- render & events ----------
const ICON = {
  now: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 2a8 8 0 0 0 0 16z" fill="currentColor"/></svg>',
  chinese: '<span class="hz" style="font-size:18px">時</span>',
  schedule: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  settings: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 1.5v3M10 15.5v3M1.5 10h3M15.5 10h3M4 4l2.1 2.1M13.9 13.9L16 16M4 16l2.1-2.1M13.9 6.1L16 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const TABS = Object.entries(ICON);
function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map(([id, ico]) =>
    `<button data-tab="${id}" aria-current="${tab === id || (tab === 'about' && id === prevTab) ? 'page' : 'false'}"><span class="ico">${ico}</span>${t('tab.' + id)}</button>`).join('');
}
function renderProfile() {
  const sex = S.sex === 'male' ? '♂' : '♀';
  const label = `${t('set.sex')}: ${t('set.sex.' + S.sex)} · ${t('set.language')}: ${lang.toUpperCase()}`;
  const btn = document.getElementById('profile');
  btn.innerHTML = `<span class="sex" aria-hidden="true">${sex}</span><span>${lang.toUpperCase()}</span>`;
  btn.setAttribute('aria-label', label);
  btn.title = label;
  document.getElementById('brand').textContent = t('app.title');
}
function render() {
  const now = new Date();
  const views = { now: viewNow, chinese: viewChinese, schedule: viewSchedule, settings: viewSettings, about: viewAbout };
  view.innerHTML = views[tab](now);
  renderTabs();
  renderProfile();
}
function applyTheme() {
  if (S.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-tab],[data-go],[data-set],[data-date],[data-city],#locate,#saveManual,#datePick');
  if (!el) return;
  if (el.id === 'datePick') {
    const inp = document.getElementById('dateInput');
    try { inp.showPicker(); } catch { inp.focus(); inp.click(); }
    return;
  }
  if (el.dataset.tab || el.dataset.go) {
    const next = el.dataset.tab || el.dataset.go;
    if (next === 'about' && tab !== 'about') prevTab = tab;
    tab = next; window.scrollTo(0, 0); render();
    const anchor = el.dataset.anchor && document.getElementById(el.dataset.anchor);
    if (anchor) anchor.scrollIntoView({ block: 'start' });
    return; }
  if (el.dataset.date) { schedDate = parseYmd(el.dataset.date); render(); return; }
  if (el.id === 'locate') { locate(); render(); return; }
  if (el.id === 'saveManual') {
    const lat = +document.getElementById('lat').value, lon = +document.getElementById('lon').value;
    const tz = document.getElementById('tz').value;
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      S.place = { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, lat, lon, tz };
      saveSettings(); setFormatters(); invalidate(); render();
    }
    return;
  }
  if (el.dataset.city) {
    const [name, cc, lat, lon, tzi] = cityData.cities[+el.dataset.city];
    S.place = { name: `${name}, ${cc}`, lat, lon, tz: cityData.tz[tzi] };
    saveSettings(); setFormatters(); invalidate(); render(); return;
  }
  if (el.dataset.set) {
    const name = el.dataset.set; const v = el.dataset.value;
    S[name] = v;
    saveSettings(); invalidate();
    if (name === 'lang') { await loadLang(); setFormatters(); }
    if (name === 'theme') applyTheme();
    if (name === 'placeMode' && v === 'geo') locate();
    if (name === 'placeMode' && v === 'city') loadCities();
    render();
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'period') { S.period = +e.target.value; saveSettings(); invalidate(); render(); }
  if (e.target.id === 'hanzi') { S.hanzi = e.target.checked; saveSettings(); render(); }
  if (e.target.id === 'dateInput' && e.target.value) { schedDate = parseYmd(e.target.value); render(); }
});

let regionNames;
document.addEventListener('input', async e => {
  if (e.target.id !== 'citySearch') return;
  const q = e.target.value.trim().toLowerCase();
  const out = document.getElementById('cityResults');
  if (q.length < 2) { out.innerHTML = ''; return; }
  const data = await loadCities();
  try { regionNames = new Intl.DisplayNames([lang], { type: 'region' }); } catch { regionNames = null; }
  const hits = [];
  for (let i = 0; i < data.cities.length && hits.length < 20; i++) {
    if (data.cities[i][0].toLowerCase().startsWith(q)) hits.push(i);
  }
  for (let i = 0; i < data.cities.length && hits.length < 20; i++) {
    if (!hits.includes(i) && data.cities[i][0].toLowerCase().includes(q)) hits.push(i);
  }
  out.innerHTML = hits.map(i => {
    const [name, cc] = data.cities[i];
    return `<li><button data-city="${i}">${esc(name)}, <span class="muted">${esc(regionNames ? regionNames.of(cc) : cc)}</span></button></li>`;
  }).join('');
});

// Countdown every second; full re-render when a boundary passes or the minute changes.
let lastMinute = -1;
setInterval(() => {
  const now = new Date();
  const m = Math.floor(now / 60e3);
  if (tab === 'settings' || tab === 'about') return;
  if (m !== lastMinute) { lastMinute = m; render(); return; }
  if (tab === 'now') {
    const { day } = calcNow(now);
    const cd = document.getElementById('cd');
    if (!cd || day.polar) return;
    const cur = currentSegment(day, now);
    if (!cur) { invalidate(); render(); return; }
    cd.textContent = countdown(cur.segment.end - now);
  }
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { invalidate(); render(); } });

// ---------- start ----------
(async function start() {
  applyTheme();
  await loadLang();
  setFormatters();
  if (S.placeMode === 'geo') locate();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
