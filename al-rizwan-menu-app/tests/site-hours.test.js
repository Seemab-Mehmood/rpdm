const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/js/site-hours.js');

const TZ = 'Asia/Karachi'; // UTC+5, no DST
// Build a Date for a Karachi wall-clock time. 2026-09-21 is a Monday.
function karachi(dayIndex, hh, mm = 0) {
  return new Date(Date.UTC(2026, 8, 21 + dayIndex, hh - 5, mm));
}
const all = (entry) => H.DAY_KEYS.map(day => ({ day, open: '09:00', close: '23:00', ...entry }));

test('zonedNow reads weekday/time in the restaurant timezone, not the server one', () => {
  const z = H.zonedNow(TZ, new Date(Date.UTC(2026, 8, 24, 22, 0)));
  assert.deepEqual(z, { dayIndex: 4, minutes: 180 });
});

test('midnight is 0:00, never 24:00', () => {
  const z = H.zonedNow(TZ, karachi(2, 0, 0));
  assert.deepEqual(z, { dayIndex: 2, minutes: 0 });
});

test('all days 24h → open 24 hours, any time', () => {
  const s = H.getStatus(all({ mode: '24h' }), TZ, karachi(3, 3, 17));
  assert.equal(s.isOpen, true);
  assert.equal(s.is24x7, true);
  assert.equal(s.label, 'Open 24 hours');
});

test('normal daily hours: open inside the window, closed outside', () => {
  const hrs = all({ mode: 'hours', open: '09:00', close: '23:00' });
  const open = H.getStatus(hrs, TZ, karachi(1, 14, 0));
  assert.equal(open.isOpen, true);
  assert.equal(open.detail, 'until 11:00 PM');

  const early = H.getStatus(hrs, TZ, karachi(1, 7, 30));
  assert.equal(early.isOpen, false);
  assert.equal(early.detail, 'opens 9:00 AM');

  const late = H.getStatus(hrs, TZ, karachi(1, 23, 30));
  assert.equal(late.isOpen, false);
  assert.equal(late.detail, 'opens tomorrow 9:00 AM');
});

test('boundaries: open at exactly opening time, closed at exactly closing time', () => {
  const hrs = all({ mode: 'hours', open: '09:00', close: '23:00' });
  assert.equal(H.getStatus(hrs, TZ, karachi(0, 9, 0)).isOpen, true);
  assert.equal(H.getStatus(hrs, TZ, karachi(0, 8, 59)).isOpen, false);
  assert.equal(H.getStatus(hrs, TZ, karachi(0, 22, 59)).isOpen, true);
  assert.equal(H.getStatus(hrs, TZ, karachi(0, 23, 0)).isOpen, false);
});

test('overnight hours (12:00 → 02:00) stay open past midnight', () => {
  const hrs = all({ mode: 'hours', open: '12:00', close: '02:00' });
  const eve = H.getStatus(hrs, TZ, karachi(2, 22, 0));
  assert.equal(eve.isOpen, true);
  assert.equal(eve.detail, 'until 2:00 AM');

  const after = H.getStatus(hrs, TZ, karachi(3, 1, 0));
  assert.equal(after.isOpen, true);
  assert.equal(after.detail, 'until 2:00 AM');

  const gap = H.getStatus(hrs, TZ, karachi(3, 5, 0));
  assert.equal(gap.isOpen, false);
  assert.equal(gap.detail, 'opens 12:00 PM');
});

test('Sunday overnight shift wraps into Monday morning', () => {
  const hrs = all({ mode: 'hours', open: '12:00', close: '02:00' });
  assert.equal(H.getStatus(hrs, TZ, karachi(0, 1, 0)).isOpen, true);
  const onlySun = H.DAY_KEYS.map(day => ({
    day, mode: day === 'sun' ? 'hours' : 'closed', open: '12:00', close: '02:00'
  }));
  assert.equal(H.getStatus(onlySun, TZ, karachi(0, 1, 0)).isOpen, true);
  assert.equal(H.getStatus(onlySun, TZ, karachi(0, 3, 0)).isOpen, false);
});

test('a closed day: opens next open day, phrased with the weekday', () => {
  const hrs = H.DAY_KEYS.map(day => ({
    day, mode: day === 'fri' ? 'closed' : 'hours', open: '10:00', close: '22:00'
  }));
  const s = H.getStatus(hrs, TZ, karachi(3, 23, 0));
  assert.equal(s.isOpen, false);
  assert.equal(s.detail, 'opens Sat 10:00 AM');
});

test('consecutive 24h days chain: closing time is the end of the chain', () => {
  const hrs = H.DAY_KEYS.map(day => ({
    day, mode: ['mon', 'tue'].includes(day) ? '24h' : 'closed', open: '09:00', close: '23:00'
  }));
  const s = H.getStatus(hrs, TZ, karachi(0, 10, 0));
  assert.equal(s.isOpen, true);
  assert.equal(s.is24x7, false);
  assert.equal(s.detail, 'until Wed 12:00 AM');
});

test('every day closed → permanently closed, no crash', () => {
  const s = H.getStatus(all({ mode: 'closed' }), TZ, karachi(0, 12));
  assert.equal(s.isOpen, false);
  assert.equal(s.label, 'Closed');
  assert.equal(s.detail, '');
});

test('garbage / missing hours fall back safely to open 24h', () => {
  assert.equal(H.getStatus(undefined, TZ, karachi(0, 12)).is24x7, true);
  assert.equal(H.normalize(null).length, 7);
});

test('unknown timezone falls back to device time instead of throwing', () => {
  assert.doesNotThrow(() => H.getStatus(all({ mode: '24h' }), 'Not/AZone', new Date()));
});

test('formatTime', () => {
  assert.equal(H.formatTime('00:00'), '12:00 AM');
  assert.equal(H.formatTime('12:00'), '12:00 PM');
  assert.equal(H.formatTime('13:05'), '1:05 PM');
  assert.equal(H.formatTime('23:59'), '11:59 PM');
});

test('summarize: identical days collapse to "Every day"', () => {
  assert.deepEqual(H.summarize(all({ mode: '24h' })), [{ days: 'Every day', text: 'Open 24 hours' }]);
});

test('summarize: groups consecutive identical days', () => {
  const hrs = H.DAY_KEYS.map(day => {
    if (day === 'fri') return { day, mode: 'closed', open: '09:00', close: '23:00' };
    if (day === 'sat' || day === 'sun') return { day, mode: 'hours', open: '12:00', close: '02:00' };
    return { day, mode: 'hours', open: '09:00', close: '23:00' };
  });
  assert.deepEqual(H.summarize(hrs), [
    { days: 'Mon–Thu', text: '9:00 AM – 11:00 PM' },
    { days: 'Fri', text: 'Closed' },
    { days: 'Sat & Sun', text: '12:00 PM – 2:00 AM (next day)' },
  ]);
});
