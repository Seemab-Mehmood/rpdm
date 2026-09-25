/*
 * site-hours.js — timezone-aware "open now / opens at / until" logic for the
 * restaurant's weekly hours. Works both as a browser <script> (exposes
 * window.SiteHours) and as a plain Node module (module.exports), so the same
 * file is used by the customer page and by the test suite.
 *
 * A week is described as an array of 7 day entries, one per DAY_KEYS entry:
 *   { day: 'mon', mode: '24h' | 'hours' | 'closed', open: 'HH:MM', close: 'HH:MM' }
 * `open`/`close` are only used when mode === 'hours'. A close time that is
 * less than or equal to the open time (e.g. 12:00 -> 02:00) is treated as an
 * overnight shift that spills into the next calendar day.
 */
(function (root, factory) {
  const mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;
  }
  if (root) {
    root.SiteHours = mod;
  }
})(typeof window !== 'undefined' ? window : this, function () {
  const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const DAY_ABBREV = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const MINUTES_PER_DAY = 1440;
  const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;
  const DEFAULT_ENTRY = { mode: '24h', open: '09:00', close: '23:00' };

  function defaultHours() {
    return DAY_KEYS.map(day => ({ day, ...DEFAULT_ENTRY }));
  }

  function isValidTime(t) {
    return typeof t === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Fills in any missing/garbage day entries with sane 24h defaults, and
  // always returns a full 7-entry array in DAY_KEYS order — so callers never
  // have to guard against a malformed or partial hours value from the DB.
  function normalize(hours) {
    if (!Array.isArray(hours) || !hours.length) return defaultHours();
    const byDay = {};
    hours.forEach(entry => {
      if (entry && typeof entry === 'object' && DAY_KEYS.includes(entry.day)) {
        byDay[entry.day] = entry;
      }
    });
    return DAY_KEYS.map(day => {
      const entry = byDay[day];
      if (!entry || !['24h', 'hours', 'closed'].includes(entry.mode)) {
        return { day, ...DEFAULT_ENTRY };
      }
      if (entry.mode === 'hours' && (!isValidTime(entry.open) || !isValidTime(entry.close))) {
        return { day, mode: '24h', open: DEFAULT_ENTRY.open, close: DEFAULT_ENTRY.close };
      }
      return {
        day,
        mode: entry.mode,
        open: isValidTime(entry.open) ? entry.open : DEFAULT_ENTRY.open,
        close: isValidTime(entry.close) ? entry.close : DEFAULT_ENTRY.close,
      };
    });
  }

  // Reads the current weekday + time-of-day as seen in `tz`, without pulling
  // in a date library. Falls back to the device's local time if `tz` isn't a
  // recognized IANA zone, so a bad timezone string never throws.
  function zonedNow(tz, now = new Date()) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const parts = fmt.formatToParts(now);
      const map = {};
      parts.forEach(p => { map[p.type] = p.value; });
      const idx = DAY_ABBREV.findIndex(a => a.toLowerCase() === (map.weekday || '').toLowerCase());
      const dayIndex = idx === -1 ? (now.getDay() + 6) % 7 : idx;
      const hour = Number(map.hour) % 24;
      const minute = Number(map.minute);
      return { dayIndex, minutes: hour * 60 + minute };
    } catch {
      const dayIndex = (now.getDay() + 6) % 7;
      return { dayIndex, minutes: now.getHours() * 60 + now.getMinutes() };
    }
  }

  function formatTime(t) {
    if (!isValidTime(t)) return t;
    let [h, m] = t.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  function formatMinutes(mins) {
    const m = ((mins % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return formatTime(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }

  // Builds every open interval (as absolute minutes on a repeating timeline)
  // across a few weeks either side of "now", then merges any that touch —
  // this is what lets two adjacent 24h days (or an overnight shift) read as
  // one continuous open block instead of stopping at midnight.
  function buildIntervals(days) {
    const intervals = [];
    for (let week = 0; week < 4; week++) {
      days.forEach((entry, i) => {
        const dayStart = week * MINUTES_PER_WEEK + i * MINUTES_PER_DAY;
        if (entry.mode === '24h') {
          intervals.push([dayStart, dayStart + MINUTES_PER_DAY]);
        } else if (entry.mode === 'hours') {
          const openMin = timeToMinutes(entry.open);
          let closeMin = timeToMinutes(entry.close);
          if (closeMin <= openMin) closeMin += MINUTES_PER_DAY;
          intervals.push([dayStart + openMin, dayStart + closeMin]);
        }
      });
    }
    intervals.sort((a, b) => a[0] - b[0]);
    const merged = [];
    intervals.forEach(([start, end]) => {
      const last = merged[merged.length - 1];
      if (last && start <= last[1]) {
        last[1] = Math.max(last[1], end);
      } else {
        merged.push([start, end]);
      }
    });
    return merged;
  }

  function dayOffsetFor(eventAbs, currentDayStartAbs) {
    const eventDayStartAbs = eventAbs - (((eventAbs % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY);
    return Math.round((eventDayStartAbs - currentDayStartAbs) / MINUTES_PER_DAY);
  }

  function dayAbbrevAt(abs) {
    const dayIndex = Math.floor((((abs % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK) / MINUTES_PER_DAY);
    return DAY_ABBREV[dayIndex];
  }

  function getStatus(hours, tz, now = new Date()) {
    const days = normalize(hours);
    const is24x7 = days.every(d => d.mode === '24h');
    if (is24x7) {
      return { isOpen: true, is24x7: true, label: 'Open 24 hours', detail: '' };
    }

    const { dayIndex, minutes } = zonedNow(tz, now);
    // Anchor "current week" at week index 1 so we can look one week back
    // (for overnight shifts spilling from the previous Sunday) and several
    // weeks forward (for a long run of closed days) without extra cases.
    const CURRENT_WEEK = 1;
    const currentAbs = CURRENT_WEEK * MINUTES_PER_WEEK + dayIndex * MINUTES_PER_DAY + minutes;
    const currentDayStartAbs = currentAbs - minutes;

    const intervals = buildIntervals(days);
    if (!intervals.length) {
      return { isOpen: false, is24x7: false, label: 'Closed', detail: '' };
    }

    const containing = intervals.find(([s, e]) => currentAbs >= s && currentAbs < e);
    if (containing) {
      const offset = dayOffsetFor(containing[1], currentDayStartAbs);
      const time = formatMinutes(containing[1]);
      const detail = offset >= 2 ? `until ${dayAbbrevAt(containing[1])} ${time}` : `until ${time}`;
      return { isOpen: true, is24x7: false, label: 'Open', detail };
    }

    const next = intervals.find(([s]) => s > currentAbs);
    if (!next) {
      return { isOpen: false, is24x7: false, label: 'Closed', detail: '' };
    }
    const offset = dayOffsetFor(next[0], currentDayStartAbs);
    const time = formatMinutes(next[0]);
    let detail;
    if (offset <= 0) detail = `opens ${time}`;
    else if (offset === 1) detail = `opens tomorrow ${time}`;
    else detail = `opens ${dayAbbrevAt(next[0])} ${time}`;
    return { isOpen: false, is24x7: false, label: 'Closed', detail };
  }

  function summarize(hours) {
    const days = normalize(hours);
    const sig = d => (d.mode === 'hours' ? `hours:${d.open}-${d.close}` : d.mode);

    const runs = [];
    days.forEach((d, i) => {
      const last = runs[runs.length - 1];
      if (last && last.sig === sig(d)) {
        last.end = i;
      } else {
        runs.push({ sig: sig(d), start: i, end: i, entry: d });
      }
    });

    return runs.map(run => {
      const len = run.end - run.start + 1;
      let daysLabel;
      if (len === 7) daysLabel = 'Every day';
      else if (len === 1) daysLabel = DAY_ABBREV[run.start];
      else if (len === 2) daysLabel = `${DAY_ABBREV[run.start]} & ${DAY_ABBREV[run.end]}`;
      else daysLabel = `${DAY_ABBREV[run.start]}\u2013${DAY_ABBREV[run.end]}`;

      let text;
      if (run.entry.mode === '24h') text = 'Open 24 hours';
      else if (run.entry.mode === 'closed') text = 'Closed';
      else {
        const openMin = timeToMinutes(run.entry.open);
        const closeMin = timeToMinutes(run.entry.close);
        text = `${formatTime(run.entry.open)} \u2013 ${formatTime(run.entry.close)}`;
        if (closeMin <= openMin) text += ' (next day)';
      }
      return { days: daysLabel, text };
    });
  }

  return { DAY_KEYS, normalize, zonedNow, getStatus, formatTime, summarize };
});
