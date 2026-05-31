// State, calculations, seed data — ported from app-state.jsx

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Pinned reference date matches prototype seed
export const TODAY = new Date(2026, 4, 28); // May 28 2026 (Thu)

const pad = (n: number) => String(n).padStart(2, '0');
export const dsOf = (d: Date) => `${d.getFullYear()}_${pad(d.getMonth() + 1)}_${pad(d.getDate())}`;
export const dateOfDs = (ds: string) => { const [y, m, d] = ds.split('_').map(Number); return new Date(y, m - 1, d); };
export const labelOf = (ds: string) => { const d = dateOfDs(ds); return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`; };

export function mondayOf(date: Date) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
export function addDays(date: Date, n: number) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
export function weekKey(offset = 0) { return dsOf(addDays(mondayOf(TODAY), offset * 7)); }
export function offsetWeekKey(key: string, delta: number) { return dsOf(addDays(dateOfDs(key), delta * 7)); }
export function weekRangeLabel(key: string) {
  const m = dateOfDs(key); const s = addDays(m, 6);
  if (m.getMonth() === s.getMonth()) return `${MONTHS_SHORT[m.getMonth()]} ${m.getDate()} – ${s.getDate()}`;
  return `${MONTHS_SHORT[m.getMonth()]} ${m.getDate()} – ${MONTHS_SHORT[s.getMonth()]} ${s.getDate()}`;
}

// ---- calculations ----------------------------------------------------------
function parseTimeToMinutes(t: string) {
  const match = t.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!match) return 0;
  let h = parseInt(match[1], 10); const mins = parseInt(match[2] || '0', 10); const p = match[3];
  if (p === 'am') { if (h === 12) h = 0; } else if (h !== 12) h += 12;
  return h * 60 + mins;
}
export function calcHours(start: string, end: string) {
  let s = parseTimeToMinutes(start), e = parseTimeToMinutes(end);
  if (e <= s) e += 1440;
  return Math.round(((e - s) / 60) * 10) / 10;
}
export const calcTotalHours = (h: number, ot: number) => Math.round((h + ot / 60) * 100) / 100;
export const calcWageEarnings = (h: number, wage: number) => Math.round(h * wage * 100) / 100;
export const calcDph = (tips: number, wageE: number, h: number) => h === 0 ? 0 : Math.round(((tips + wageE) / h) * 100) / 100;
export function fmtCur(n: number, sym = '$') {
  const neg = n < 0; n = Math.abs(n);
  return (neg ? '-' : '') + sym + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function fmtCur0(n: number, sym = '$') { return sym + Math.round(n).toLocaleString('en-US'); }

// ---- types -----------------------------------------------------------------
export interface Shift { ds: string; label: string; start: string; end: string; hours: number; }
export interface WeekData { schedule?: Shift[]; [key: string]: unknown; }
export interface Weeks { [key: string]: WeekData; }
export interface Account { name: string; email: string; role: string; }
export interface AppState { weeks: Weeks; auth: { signedIn: boolean; onboarded: boolean }; account: Account; tweaks: Tweaks; }
export interface Tweaks { wage: number; currency: string; goal: number; dark: boolean; }

export function weekTotals(wd: WeekData, wage: number) {
  let tips = 0, wageE = 0, hours = 0, logged = 0;
  (wd.schedule || []).forEach((s) => {
    const ot = (wd[`ot_${s.ds}`] as number) || 0;
    const th = calcTotalHours(s.hours, ot);
    const tip = wd[`tip_${s.ds}`] as number | undefined;
    if (tip != null) { tips += tip; wageE += calcWageEarnings(th, wage); hours += th; logged++; }
  });
  return { tips, wageE, hours, logged, combined: tips + wageE, dph: calcDph(tips, wageE, hours), count: (wd.schedule || []).length };
}

// ---- seed ------------------------------------------------------------------
function buildShift(monday: Date, dayOffset: number, start: string, end: string): Shift {
  const d = addDays(monday, dayOffset);
  return { ds: dsOf(d), label: labelOf(dsOf(d)), start, end, hours: calcHours(start, end) };
}
function rng(seed: number) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export function buildSeed(): Weeks {
  const weeks: Weeks = {};
  const m0 = mondayOf(TODAY);
  const curShifts = [
    buildShift(m0, 0, '6:00pm', '11:00pm'),
    buildShift(m0, 2, '5:00pm', '11:30pm'),
    buildShift(m0, 3, '5:00pm', '11:00pm'),
    buildShift(m0, 4, '4:00pm', '12:00am'),
    buildShift(m0, 5, '8:00am', '2:00pm'),
  ];
  const cur: WeekData = { schedule: curShifts };
  cur[`tip_${curShifts[0].ds}`] = 62;
  cur[`tip_${curShifts[1].ds}`] = 88;
  weeks[weekKey(0)] = cur;

  for (let off = -8; off < 0; off++) {
    const m = addDays(m0, off * 7);
    const r = rng(1000 + off * 37);
    const plan: [number, string, string][] = [[0,'6:00pm','11:00pm'],[2,'5:00pm','11:30pm'],[3,'5:00pm','11:00pm'],[4,'4:00pm','12:00am'],[5,'8:00am','2:00pm']];
    const sched = plan.map((p) => buildShift(m, p[0], p[1], p[2]));
    const wd: WeekData = { schedule: sched };
    sched.forEach((s) => {
      const dow = dateOfDs(s.ds).getDay();
      const base = dow === 5 || dow === 6 ? 120 : dow === 4 ? 95 : 70;
      wd[`tip_${s.ds}`] = Math.round(base + r() * 70 - 15);
      if (r() > 0.7) wd[`ot_${s.ds}`] = 30;
    });
    weeks[dsOf(m)] = wd;
  }
  return weeks;
}

// ---- persistence -----------------------------------------------------------
const STORE_KEY = 'aphex_app_v1';
export function loadStore(): AppState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const state: AppState = JSON.parse(raw);
    // Migrate stale account name left over from prototype defaults
    if (state.account?.name === 'Maya' || state.account?.name === 'Maya Rivera') {
      state.account = DEFAULT_ACCOUNT;
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }
    return state;
  } catch { }
  return null;
}
export function saveStore(obj: AppState) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch { }
}

export const DEFAULT_ACCOUNT: Account = { name: 'Sebastian', email: 'youremail@aphex.com', role: 'Barista · Corner Café' };
export const DEFAULT_TWEAKS: Tweaks = { wage: 17, currency: '$', goal: 600, dark: true };
