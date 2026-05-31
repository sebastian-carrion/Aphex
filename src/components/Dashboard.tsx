"use client";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icon, Card, CardHead, Pill, Segmented, Bars, Ring, Avatar, Modal } from "./ui/primitives";
import {
  TODAY, DAY_NAMES, DAY_FULL, weekKey, offsetWeekKey, weekRangeLabel,
  dateOfDs, calcTotalHours, calcWageEarnings, calcDph, fmtCur, fmtCur0,
  weekTotals, buildSeed, loadStore, saveStore, DEFAULT_ACCOUNT, DEFAULT_TWEAKS,
  AppState, WeekData, Shift, Tweaks,
} from "@/lib/state";

// ---- Clock -----------------------------------------------------------------
function useClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setT(new Date()), 20000); return () => clearInterval(id); }, []);
  let h = t.getHours(); const m = t.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

// ---- Log Modal -------------------------------------------------------------
function LogModal({ shift, weekData, weekKeyCur, wage, currency, updateWeek, onClose }: {
  shift: Shift | null; weekData: WeekData; weekKeyCur: string; wage: number; currency: string;
  updateWeek: (k: string, d: WeekData) => void; onClose: () => void;
}) {
  const [tip, setTip] = useState('');
  const tipKey = shift ? `tip_${shift.ds}` : '';
  const otKey = shift ? `ot_${shift.ds}` : '';
  const ot = shift ? ((weekData[otKey] as number) || 0) : 0;

  useEffect(() => {
    if (shift) setTip(weekData[tipKey] != null ? String(weekData[tipKey]) : '');
  }, [shift, tipKey, weekData]);

  if (!shift) return null;
  const th = calcTotalHours(shift.hours, ot);
  const wageE = calcWageEarnings(th, wage);
  const setOt = (v: number) => updateWeek(weekKeyCur, { ...weekData, [otKey]: Math.max(0, v) });
  const save = () => {
    const n = parseFloat(tip); if (isNaN(n) || n < 0) return;
    updateWeek(weekKeyCur, { ...weekData, [tipKey]: Math.round(n * 100) / 100 }); onClose();
  };
  const clear = () => {
    const w = { ...weekData }; delete w[tipKey]; updateWeek(weekKeyCur, w); onClose();
  };

  return (
    <Modal open title={`Log ${shift.label}`} onClose={onClose}>
      <p className="text-white/40 text-xs mb-4">{shift.start} – {shift.end} · {th}h{ot ? ` (+${ot}m OT)` : ''} · wage {fmtCur(wageE, currency)}</p>
      <label className="block text-xs text-white/50 mb-1.5 font-medium">Tips earned</label>
      <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 focus-within:border-white/30 transition-colors">
        <span className="text-white font-bold mr-2">{currency}</span>
        <input autoFocus inputMode="decimal" placeholder="0.00" value={tip} onChange={(e) => setTip(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          className="flex-1 bg-transparent text-white outline-none placeholder:text-white/20 text-lg" />
      </div>
      <label className="block text-xs text-white/50 mb-2 font-medium">Overtime</label>
      <div className="flex gap-2 flex-wrap mb-5">
        <Pill sm onClick={() => setOt(ot + 30)}>+30 min</Pill>
        <Pill sm onClick={() => setOt(ot + 60)}>+1 hr</Pill>
        {ot > 0 && <Pill sm onClick={() => setOt(0)}>clear OT ({ot}m)</Pill>}
      </div>
      <div className="flex gap-2">
        {weekData[tipKey] != null && (
          <button onClick={clear} className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors">Clear</button>
        )}
        <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors">Save</button>
      </div>
    </Modal>
  );
}

// ---- Nav -------------------------------------------------------------------
const NAV = [
  { v: 'dashboard', l: 'Dashboard', icon: 'dashboard' },
  { v: 'earnings', l: 'Earnings', icon: 'chart' },
  { v: 'schedule', l: 'Schedule', icon: 'calendar' },
  { v: 'settings', l: 'Settings', icon: 'settings' },
];

// ---- Dashboard view --------------------------------------------------------
const METRICS = [{ v: 'tips', l: 'Tips' }, { v: 'wage', l: 'Wage' }, { v: 'dph', l: '$/hr' }];

function DashboardView({ weekKeyCur, setWeekKeyCur, weekData, wage, currency, goal, updateWeek, account }: {
  weekKeyCur: string; setWeekKeyCur: (k: string) => void; weekData: WeekData; wage: number;
  currency: string; goal: number; updateWeek: (k: string, d: WeekData) => void; account: { name: string };
}) {
  const clock = useClock();
  const [metric, setMetric] = useState('tips');
  const [logDs, setLogDs] = useState<string | null>(null);
  const t = weekTotals(weekData, wage);
  const sched = (weekData.schedule || []).slice().sort((a, b) => a.ds.localeCompare(b.ds));
  const isCurrent = weekKeyCur === weekKey(0);

  const perDay = sched.map((s) => {
    const ot = (weekData[`ot_${s.ds}`] as number) || 0;
    const th = calcTotalHours(s.hours, ot);
    const tip = weekData[`tip_${s.ds}`] as number | undefined;
    const wageE = calcWageEarnings(th, wage);
    return { s, tip, wageE, th, logged: tip != null, dph: tip != null ? calcDph(tip, wageE, th) : 0, day: DAY_NAMES[dateOfDs(s.ds).getDay()] };
  });
  const barData = perDay.map((d) => metric === 'tips' ? (d.tip || 0) : metric === 'wage' ? d.wageE : d.dph);
  const bigVal = metric === 'tips' ? t.tips : metric === 'wage' ? t.wageE : t.dph;

  const pending = perDay.filter((d) => !d.logged);
  const tonight = pending[0];
  const nextShift = sched.map((s) => ({ s, d: dateOfDs(s.ds) })).find((x) => x.d >= TODAY) || (sched[0] && { s: sched[0], d: dateOfDs(sched[0].ds) });

  const [tonightTip, setTonightTip] = useState('');
  useEffect(() => { setTonightTip(''); }, [tonight?.s.ds]);
  const saveTonight = () => {
    if (!tonight) return; const n = parseFloat(tonightTip); if (isNaN(n) || n < 0) return;
    updateWeek(weekKeyCur, { ...weekData, [`tip_${tonight.s.ds}`]: Math.round(n * 100) / 100 }); setTonightTip('');
  };
  const addTonightOt = (m: number) => {
    if (!tonight) return;
    updateWeek(weekKeyCur, { ...weekData, [`ot_${tonight.s.ds}`]: ((weekData[`ot_${tonight.s.ds}`] as number) || 0) + m });
  };

  const goalPct = Math.min(100, Math.round((t.combined / goal) * 100));

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-white/40 text-sm mt-0.5">Good evening, {account.name.split(' ')[0]} — here&apos;s your week.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1.5 text-white/40 text-sm"><Icon name="clock" size={14} />{clock}</span>
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2 py-1">
            <button onClick={() => setWeekKeyCur(offsetWeekKey(weekKeyCur, -1))} className="text-white/50 hover:text-white p-0.5 transition-colors"><Icon name="chevL" size={15} /></button>
            <span className="text-xs text-white/70 px-1 whitespace-nowrap">{weekRangeLabel(weekKeyCur)}{isCurrent && <em className="not-italic text-white ml-1">· this week</em>}</span>
            <button onClick={() => setWeekKeyCur(offsetWeekKey(weekKeyCur, 1))} className="text-white/50 hover:text-white p-0.5 transition-colors"><Icon name="chevR" size={15} /></button>
          </div>
        </div>
      </div>

      {sched.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-white/40">
          <Icon name="calendar" size={28} />
          <p className="text-sm">No shifts scheduled this week.</p>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {/* Earnings */}
          <Card className="col-span-full lg:col-span-2">
            <CardHead title="Earnings this week" sub={`${t.logged} of ${t.count} shifts logged`}
              right={<Segmented sm options={METRICS} value={metric} onChange={setMetric} />} />
            <div className="text-4xl font-bold text-white tracking-tight">
              {metric === 'dph' ? fmtCur(bigVal, currency) : fmtCur0(bigVal, currency)}
              {metric === 'dph' && <span className="text-xl text-white/40 font-normal ml-1">/ hr</span>}
            </div>
            <Bars data={barData} height={100} labels={perDay.map((d) => d.day)} accentIndex={tonight ? perDay.indexOf(tonight) : -1} />
          </Card>

          {/* Tonight */}
          <Card accent>
            <CardHead title="Tonight" />
            {tonight ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="font-bold text-white">{tonight.s.label.split(' ')[0]} <span className="font-normal text-white/50 text-sm">{tonight.s.start} – {tonight.s.end}</span></div>
                  <div className="text-xs text-white/40 mt-0.5">{tonight.th}h · wage {fmtCur(tonight.wageE, currency)}</div>
                </div>
                <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-white/30 transition-colors">
                  <span className="text-white font-bold mr-2">{currency}</span>
                  <input inputMode="decimal" placeholder="tonight's tips" value={tonightTip}
                    onChange={(e) => setTonightTip(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveTonight()}
                    className="flex-1 bg-transparent text-white outline-none text-sm placeholder:text-white/20" />
                  <button onClick={saveTonight} className="text-white/50 hover:text-white ml-1 transition-colors"><Icon name="check" size={16} /></button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">+ OT</span>
                  <Pill sm onClick={() => addTonightOt(30)}>+30m</Pill>
                  <Pill sm onClick={() => addTonightOt(60)}>+1h</Pill>
                  {((weekData[`ot_${tonight.s.ds}`] as number) || 0) > 0 && (
                    <span className="text-xs text-white/60">+{weekData[`ot_${tonight.s.ds}`] as number}m</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Icon name="check" size={20} /></div>
                <b className="text-white text-sm">All caught up</b>
                <span className="text-white/40 text-xs">Every shift this week is logged.</span>
              </div>
            )}
          </Card>

          {/* This week summary */}
          <Card>
            <CardHead title="This week" />
            <div className="text-3xl font-bold text-white tracking-tight mb-4">{fmtCur(t.combined, currency)}</div>
            <div className="flex flex-col gap-2">
              {[
                { label: 'Tips', val: fmtCur(t.tips, currency), color: 'bg-white' },
                { label: 'Wage', val: fmtCur(t.wageE, currency), color: 'bg-white/50' },
                { label: 'Avg $/hr', val: fmtCur(t.dph, currency), color: 'bg-white/30' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2"><span className={cn('w-2 h-2 rounded-full', color)} /><span className="text-white/60">{label}</span></div>
                  <b className="text-white">{val}</b>
                </div>
              ))}
            </div>
          </Card>

          {/* Next shift */}
          <Card light>
            <CardHead title="Next shift" />
            {nextShift ? (
              <div>
                <div className="text-xl font-bold text-white">{DAY_FULL[nextShift.d.getDay()]}</div>
                <div className="text-white/60 text-sm mt-0.5">{nextShift.s.start} – {nextShift.s.end}</div>
                <div className="text-white/40 text-xs mt-1">{nextShift.s.hours}h · ~{fmtCur(calcWageEarnings(nextShift.s.hours, wage), currency)} wage</div>
              </div>
            ) : <p className="text-white/40 text-sm">No upcoming shifts.</p>}
          </Card>

          {/* Daily breakdown */}
          <Card className="col-span-full lg:col-span-2">
            <CardHead title="Daily breakdown" sub="Tap a day to log or edit" right={<Pill sm>Week</Pill>} />
            <div className="flex gap-2 mt-1">
              {perDay.map((d) => {
                const maxTip = Math.max(1, ...perDay.map((x) => x.tip || 0));
                return (
                  <button key={d.s.ds} onClick={() => setLogDs(d.s.ds)}
                    className={cn('flex-1 flex flex-col items-center gap-1.5 rounded-xl py-2 transition-colors', d.logged ? 'hover:bg-white/5' : 'hover:bg-white/5 opacity-60')}>
                    <div className="w-full flex justify-center items-end" style={{ height: 64 }}>
                      <div className={cn('w-5 rounded-t-sm min-h-[4px]', d.logged ? 'bg-white' : 'bg-white/15')}
                        style={{ height: Math.max(4, ((d.tip || 0) / maxTip) * 64) }} />
                    </div>
                    <span className="text-[10px] text-white/50">{d.day}</span>
                    <span className="text-xs font-semibold text-white">{d.logged ? fmtCur0(d.tip!, currency) : '—'}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Weekly goal */}
          <Card light>
            <CardHead title="Weekly goal" sub={`${fmtCur0(t.combined, currency)} of ${fmtCur0(goal, currency)}`}
              right={<Pill sm><Icon name="target" size={12} /> Edit</Pill>} />
            <div className="flex items-center gap-4 mt-2">
              <Ring pct={goalPct} value={`${goalPct}%`} label="to goal" />
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex gap-1.5">
                  {sched.map((s) => (
                    <span key={s.ds} className={cn('w-3 h-3 rounded-full border', weekData[`tip_${s.ds}`] != null ? 'bg-white border-white' : 'bg-transparent border-white/20')} title={s.label} />
                  ))}
                </div>
                <p className="text-xs text-white/40">
                  {goalPct >= 100 ? 'Goal smashed — nice week! 🎉' : `${fmtCur0(Math.max(0, goal - t.combined), currency)} to go · ${pending.length} shift${pending.length === 1 ? '' : 's'} left`}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      <LogModal
        shift={logDs ? sched.find((s) => s.ds === logDs) ?? null : null}
        weekData={weekData} weekKeyCur={weekKeyCur} wage={wage} currency={currency}
        updateWeek={updateWeek} onClose={() => setLogDs(null)}
      />
    </div>
  );
}

// ---- Simple Earnings stub --------------------------------------------------
function EarningsView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/30">
      <Icon name="chart" size={32} />
      <p className="text-sm">Earnings views — coming soon</p>
    </div>
  );
}

// ---- Simple Schedule stub --------------------------------------------------
function ScheduleView() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-white/30">
      <Icon name="calendar" size={32} />
      <p className="text-sm">Schedule — coming soon</p>
    </div>
  );
}

// ---- Settings stub ---------------------------------------------------------
function SettingsView({ tweaks, setTweak, onSignOut }: { tweaks: Tweaks; setTweak: (k: keyof Tweaks, v: unknown) => void; onSignOut: () => void }) {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <Card>
        <CardHead title="Hourly wage" />
        <input type="number" value={tweaks.wage} step={0.5}
          onChange={(e) => setTweak('wage', parseFloat(e.target.value) || 17)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/30 transition-colors" />
      </Card>
      <Card>
        <CardHead title="Weekly goal" />
        <input type="number" value={tweaks.goal} step={25}
          onChange={(e) => setTweak('goal', parseInt(e.target.value) || 600)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/30 transition-colors" />
      </Card>
      <Card>
        <CardHead title="Currency" />
        <div className="flex gap-2">
          {['$', '£', '€'].map((sym) => (
            <Pill key={sym} active={tweaks.currency === sym} onClick={() => setTweak('currency', sym)}>{sym}</Pill>
          ))}
        </div>
      </Card>
      <button onClick={onSignOut} className="flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors mt-2">
        <Icon name="logout" size={16} /> Sign out
      </button>
    </div>
  );
}

// ---- App Shell -------------------------------------------------------------
export function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const [state, setState] = useState<AppState>(() => {
    const stored = loadStore();
    if (stored?.weeks) return stored;
    return { weeks: buildSeed(), auth: { signedIn: true, onboarded: true }, account: DEFAULT_ACCOUNT, tweaks: DEFAULT_TWEAKS };
  });
  const [nav, setNav] = useState('dashboard');
  const [weekKeyCur, setWeekKeyCur] = useState(() => weekKey(0));

  useEffect(() => { saveStore(state); }, [state]);

  const weekData = state.weeks[weekKeyCur] || { schedule: [] };
  const updateWeek = useCallback((k: string, wd: WeekData) => setState((p) => ({ ...p, weeks: { ...p.weeks, [k]: wd } })), []);
  const setTweak = useCallback((k: keyof Tweaks, v: unknown) => setState((p) => ({ ...p, tweaks: { ...p.tweaks, [k]: v } })), []);
  const { wage, currency, goal } = state.tweaks;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3.5 border-b border-white/[0.08] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-white flex items-center justify-center">
            <Icon name="coffee" size={14} className="text-black" />
          </span>
          <span className="font-bold text-white text-sm tracking-tight">Aphex</span>
        </div>
        <nav className="hidden sm:flex items-center gap-1">
          {NAV.map((item) => (
            <button key={item.v} onClick={() => setNav(item.v)}
              className={cn('px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
                nav === item.v ? 'bg-white text-black' : 'text-white/50 hover:text-white'
              )}>
              {item.l}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/50 hidden sm:block">{state.account.name}</span>
          <Avatar name={state.account.name} size={30} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">
        {nav === 'dashboard' && (
          <DashboardView weekKeyCur={weekKeyCur} setWeekKeyCur={setWeekKeyCur}
            weekData={weekData} wage={wage} currency={currency} goal={goal}
            updateWeek={updateWeek} account={state.account} />
        )}
        {nav === 'earnings' && <EarningsView />}
        {nav === 'schedule' && <ScheduleView />}
        {nav === 'settings' && <SettingsView tweaks={state.tweaks} setTweak={setTweak} onSignOut={onSignOut} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 border-t border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-md flex">
        {NAV.map((item) => (
          <button key={item.v} onClick={() => setNav(item.v)}
            className={cn('flex-1 flex flex-col items-center gap-1 py-3 text-[10px] transition-colors',
              nav === item.v ? 'text-white' : 'text-white/30'
            )}>
            <Icon name={item.icon} size={18} />
            {item.l}
          </button>
        ))}
      </nav>
    </div>
  );
}
