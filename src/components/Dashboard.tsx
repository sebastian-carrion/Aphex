"use client";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icon, Card, CardHead, Pill, Segmented, Bars, Ring, Avatar, Modal } from "./ui/primitives";
import { EtherealBackground } from "./ui/EtherealBackground";
import {
  TODAY, DAY_NAMES, DAY_FULL, MONTHS, MONTHS_SHORT, weekKey, offsetWeekKey, weekRangeLabel,
  dsOf, dateOfDs, labelOf, addDays, calcHours, calcTotalHours, calcWageEarnings, calcDph,
  fmtCur, fmtCur0, weekTotals, buildSeed, loadStore, saveStore, DEFAULT_ACCOUNT, DEFAULT_TWEAKS,
  AppState, WeekData, Weeks, Shift, Tweaks,
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

// ---- Earnings helpers & sub-views ------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');

function flattenLogged(allWeeks: Weeks, wage: number) {
  const rows: { ds: string; date: Date; tip: number; wageE: number; hours: number; combined: number; dow: number }[] = [];
  Object.values(allWeeks).forEach((wd) => {
    (wd.schedule || []).forEach((s) => {
      const tip = wd[`tip_${s.ds}`] as number | undefined;
      if (tip == null) return;
      const ot = (wd[`ot_${s.ds}`] as number) || 0;
      const th = calcTotalHours(s.hours, ot);
      const wageE = calcWageEarnings(th, wage);
      rows.push({ ds: s.ds, date: dateOfDs(s.ds), tip, wageE, hours: th, combined: tip + wageE, dow: dateOfDs(s.ds).getDay() });
    });
  });
  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

function EarnWeek({ allWeeks, weekKeyCur, wage, currency }: { allWeeks: Weeks; weekKeyCur: string; wage: number; currency: string }) {
  const wd = allWeeks[weekKeyCur] || { schedule: [] };
  const t = weekTotals(wd, wage);
  const sched = (wd.schedule || []).slice().sort((a, b) => a.ds.localeCompare(b.ds));
  const perDay = sched.map((s) => ({ day: DAY_NAMES[dateOfDs(s.ds).getDay()], tip: (wd[`tip_${s.ds}`] as number) || 0 }));
  const stats: [string, string][] = [
    ['Total tips', fmtCur(t.tips, currency)],
    ['Wage earnings', fmtCur(t.wageE, currency)],
    ['Combined', fmtCur(t.combined, currency)],
    ['Hours worked', t.hours + 'h'],
    ['Avg tips / shift', fmtCur(t.logged ? t.tips / t.logged : 0, currency)],
    ['Avg $/hr', fmtCur(t.dph, currency)],
    ['Shifts logged', `${t.logged} / ${t.count}`],
  ];
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      <Card className="col-span-full lg:col-span-2">
        <CardHead title="This week, by day" sub={weekRangeLabel(weekKeyCur)} />
        <Bars data={perDay.map((d) => d.tip)} height={150} labels={perDay.map((d) => d.day)} />
      </Card>
      <Card>
        <CardHead title="Summary" />
        <div className="flex flex-col gap-3 mt-1">
          {stats.map(([label, val]) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-white/50">{label}</span>
              <b className="text-white">{val}</b>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EarnMonth({ allWeeks, wage, currency }: { allWeeks: Weeks; wage: number; currency: string }) {
  const [ym, setYm] = useState({ y: TODAY.getFullYear(), m: TODAY.getMonth() });
  const rows = flattenLogged(allWeeks, wage);
  const byDs: Record<string, typeof rows[0]> = {};
  rows.forEach((r) => { byDs[r.ds] = r; });
  const first = new Date(ym.y, ym.m, 1);
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const startDow = first.getDay();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  let mTips = 0, mComb = 0, mShifts = 0;
  cells.forEach((d) => {
    if (!d) return;
    const ds = `${ym.y}_${pad(ym.m + 1)}_${pad(d)}`;
    const r = byDs[ds];
    if (r) { mTips += r.tip; mComb += r.combined; mShifts++; }
  });
  const maxTip = Math.max(1, ...rows.map((r) => r.tip));
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setYm((p) => p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 })} className="text-white/50 hover:text-white p-1 transition-colors"><Icon name="chevL" size={16} /></button>
        <b className="text-white text-sm">{MONTHS[ym.m]} {ym.y}</b>
        <button onClick={() => setYm((p) => p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 })} className="text-white/50 hover:text-white p-1 transition-colors"><Icon name="chevR" size={16} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-white/30 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = `${ym.y}_${pad(ym.m + 1)}_${pad(d)}`;
          const r = byDs[ds];
          const isToday = ym.y === TODAY.getFullYear() && ym.m === TODAY.getMonth() && d === TODAY.getDate();
          return (
            <div key={i} className={cn('p-1 rounded-lg min-h-[44px]', r ? 'bg-white/5' : '', isToday ? 'ring-1 ring-white/30' : '')}>
              <span className={cn('text-[11px] block', isToday ? 'text-white font-bold' : 'text-white/40')}>{d}</span>
              {r && (
                <>
                  <span className="text-[10px] text-white font-semibold block leading-tight">{fmtCur0(r.tip, currency)}</span>
                  <div className="mt-0.5 h-0.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: (r.tip / maxTip) * 100 + '%' }} />
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-4 pt-4 border-t border-white/[0.08] text-sm">
        <div className="flex-1"><div className="text-xs text-white/40">Month tips</div><b className="text-white">{fmtCur(mTips, currency)}</b></div>
        <div className="flex-1"><div className="text-xs text-white/40">Combined</div><b className="text-white">{fmtCur(mComb, currency)}</b></div>
        <div><div className="text-xs text-white/40">Shifts</div><b className="text-white">{mShifts}</b></div>
      </div>
    </Card>
  );
}

function EarnTrends({ allWeeks, wage, currency }: { allWeeks: Weeks; wage: number; currency: string }) {
  const [mode, setMode] = useState('combined');
  const series: { k: string; label: string; tips: number; wage: number; combined: number }[] = [];
  for (let o = -8; o <= 0; o++) {
    const k = weekKey(o);
    const t = weekTotals(allWeeks[k] || { schedule: [] }, wage);
    series.push({ k, label: o === 0 ? 'now' : weekRangeLabel(k).split(' – ')[0], tips: t.tips, wage: t.wageE, combined: t.combined });
  }
  const vals = series.map((s) => mode === 'tips' ? s.tips : mode === 'wage' ? s.wage : s.combined);
  const best = series.reduce((a, b) => b.combined > a.combined ? b : a, series[0]);
  const prevMonth = series.slice(0, 4).reduce((s, x) => s + x.combined, 0);
  const thisMonth = series.slice(4).reduce((s, x) => s + x.combined, 0);
  const trendPct = prevMonth ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100) : 0;
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      <Card className="col-span-full">
        <CardHead title="Earnings over time" sub="Last 9 weeks"
          right={<Segmented sm options={[{ v: 'tips', l: 'Tips' }, { v: 'wage', l: 'Wage' }, { v: 'combined', l: 'Combined' }]} value={mode} onChange={setMode} />} />
        <Bars data={vals} height={180} labels={series.map((s) => s.label)} accentIndex={series.length - 1} />
      </Card>
      <Card light>
        <CardHead title="Best week" />
        <div className="text-2xl font-bold text-white tracking-tight">{fmtCur0(best.combined, currency)}</div>
        <div className="text-xs text-white/40 mt-1">{weekRangeLabel(best.k)}</div>
      </Card>
      <Card>
        <CardHead title="Trend" />
        <div className={cn('text-2xl font-bold tracking-tight', trendPct >= 0 ? 'text-white' : 'text-red-400')}>
          {trendPct >= 0 ? '▲' : '▼'} {Math.abs(trendPct)}%
        </div>
        <div className="text-xs text-white/40 mt-1">vs previous month</div>
      </Card>
      <Card>
        <CardHead title="Projected month" />
        <div className="text-2xl font-bold text-white tracking-tight">
          {fmtCur0(thisMonth / Math.max(1, series.slice(4).length) * 4.3, currency)}
        </div>
        <div className="text-xs text-white/40 mt-1">at current pace</div>
      </Card>
    </div>
  );
}

function EarnBest({ allWeeks, wage, currency }: { allWeeks: Weeks; wage: number; currency: string }) {
  const rows = flattenLogged(allWeeks, wage);
  const agg = DAY_NAMES.map((_, dow) => {
    const ds = rows.filter((r) => r.dow === dow);
    const tipSum = ds.reduce((s, r) => s + r.tip, 0);
    return { dow, count: ds.length, avg: ds.length ? tipSum / ds.length : 0 };
  }).filter((a) => a.count > 0).sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(1, ...agg.map((a) => a.avg));
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      <Card className="col-span-full lg:col-span-2">
        <CardHead title="Best days to work" sub="Average tips per shift, all time" />
        <div className="flex flex-col gap-3 mt-2">
          {agg.map((a, i) => (
            <div key={a.dow} className="flex items-center gap-3">
              <span className="w-5 text-xs text-white/30 text-right shrink-0">{i + 1}</span>
              <span className="w-20 text-sm text-white/70 shrink-0">{DAY_FULL[a.dow]}</span>
              <div className="flex-1 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', i === 0 ? 'bg-white' : 'bg-white/40')}
                  style={{ width: (a.avg / maxAvg) * 100 + '%' }} />
              </div>
              <b className={cn('text-sm w-16 text-right shrink-0', i === 0 ? 'text-white' : 'text-white/60')}>{fmtCur(a.avg, currency)}</b>
            </div>
          ))}
        </div>
      </Card>
      <Card light>
        <CardHead title="Best time block" />
        <div className="text-2xl font-bold text-white">6–9 PM</div>
        <div className="text-xs text-white/40 mt-1">{fmtCur(24, currency)}/hr avg · evening rush</div>
      </Card>
      <Card>
        <CardHead title="Slowest" />
        <div className="text-2xl font-bold text-white">Tue AM</div>
        <div className="text-xs text-white/40 mt-1">{fmtCur(11, currency)}/hr avg</div>
      </Card>
    </div>
  );
}

function EarnYTD({ allWeeks, wage, currency }: { allWeeks: Weeks; wage: number; currency: string }) {
  const rows = flattenLogged(allWeeks, wage).filter((r) => r.date.getFullYear() === TODAY.getFullYear());
  const tips = rows.reduce((s, r) => s + r.tip, 0);
  const wageT = rows.reduce((s, r) => s + r.wageE, 0);
  const hours = rows.reduce((s, r) => s + r.hours, 0);
  const setAside = tips * 0.22;
  const tipsPct = (tips + wageT) ? Math.round((tips / (tips + wageT)) * 100) : 0;
  const [toast, setToast] = useState('');
  const doExport = (kind: string) => { setToast(`${kind} exported (demo)`); setTimeout(() => setToast(''), 1800); };
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      <Card accent className="col-span-full lg:col-span-2">
        <CardHead title={`${TODAY.getFullYear()} year to date`} sub={`Jan 1 – ${MONTHS_SHORT[TODAY.getMonth()]} ${TODAY.getDate()}`} />
        <div className="text-4xl font-bold text-white tracking-tight">{fmtCur0(tips + wageT, currency)}</div>
        <div className="flex gap-6 mt-3">
          {([['Tips', fmtCur0(tips, currency)], ['Wage', fmtCur0(wageT, currency)], ['Hours', Math.round(hours) + 'h']] as [string, string][]).map(([label, val]) => (
            <div key={label}><div className="text-xs text-white/40">{label}</div><div className="font-bold text-white">{val}</div></div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="Tax estimate" sub="Not tax advice" />
        <div className="flex flex-col gap-2 text-sm mb-3">
          <div className="flex justify-between"><span className="text-white/50">Reportable tips</span><b className="text-white">{fmtCur(tips, currency)}</b></div>
          <div className="flex justify-between"><span className="text-white/50">Set-aside (22%)</span><b className="text-white">{fmtCur(setAside, currency)}</b></div>
        </div>
        <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
          <div className="bg-white rounded-l-full" style={{ width: tipsPct + '%' }} />
          <div className="bg-white/20 rounded-r-full flex-1" />
        </div>
        <div className="flex gap-4 mt-1.5 text-[10px] text-white/40">
          <span>tips {tipsPct}%</span><span>wage {100 - tipsPct}%</span>
        </div>
      </Card>
      <Card className="col-span-full flex items-center justify-between gap-4 flex-wrap">
        <div>
          <b className="text-white text-sm">Export a clean record</b>
          <p className="text-xs text-white/40 mt-0.5">Hand your accountant a tidy summary.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => doExport('CSV')} className="px-4 py-2 rounded-xl border border-white/15 text-white/70 text-sm hover:border-white/30 hover:text-white transition-colors">CSV</button>
          <button onClick={() => doExport('PDF')} className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">PDF summary</button>
        </div>
      </Card>
      {toast && <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-white text-black text-sm font-medium px-4 py-2 rounded-full shadow-lg z-50">{toast}</div>}
    </div>
  );
}

function EarningsView({ allWeeks, weekKeyCur, wage, currency }: {
  allWeeks: Weeks; weekKeyCur: string; wage: number; currency: string;
}) {
  const [view, setView] = useState('week');
  const EARN_NAV = [
    { v: 'week', l: 'Weekly' }, { v: 'month', l: 'Calendar' }, { v: 'trends', l: 'Trends' },
    { v: 'best', l: 'Best shifts' }, { v: 'ytd', l: 'Year-to-date' },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Earnings</h1>
        <p className="text-white/40 text-sm mt-0.5">Slice your income any way you like.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {EARN_NAV.map((n) => <Pill key={n.v} active={view === n.v} onClick={() => setView(n.v)}>{n.l}</Pill>)}
      </div>
      {view === 'week' && <EarnWeek allWeeks={allWeeks} weekKeyCur={weekKeyCur} wage={wage} currency={currency} />}
      {view === 'month' && <EarnMonth allWeeks={allWeeks} wage={wage} currency={currency} />}
      {view === 'trends' && <EarnTrends allWeeks={allWeeks} wage={wage} currency={currency} />}
      {view === 'best' && <EarnBest allWeeks={allWeeks} wage={wage} currency={currency} />}
      {view === 'ytd' && <EarnYTD allWeeks={allWeeks} wage={wage} currency={currency} />}
    </div>
  );
}

// ---- Schedule --------------------------------------------------------------
const SC_DAYS: [string, number][] = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 0]];

function ScheduleView({ weekKeyCur, setWeekKeyCur, weekData, wage, currency, updateWeek }: {
  weekKeyCur: string; setWeekKeyCur: (k: string) => void; weekData: WeekData;
  wage: number; currency: string; updateWeek: (k: string, d: WeekData) => void;
}) {
  const sched = (weekData.schedule || []).slice().sort((a, b) => a.ds.localeCompare(b.ds));
  const [dow, setDow] = useState(2);
  const [start, setStart] = useState('5:00pm');
  const [end, setEnd] = useState('11:00pm');
  const hrs = calcHours(start, end);
  const isCurrent = weekKeyCur === weekKey(0);

  const add = () => {
    const monday = dateOfDs(weekKeyCur);
    const d = addDays(monday, (dow + 6) % 7);
    const ds = dsOf(d);
    const ns: Shift = { ds, label: labelOf(ds), start, end, hours: calcHours(start, end) };
    updateWeek(weekKeyCur, { ...weekData, schedule: [...sched.filter((s) => s.ds !== ds), ns].sort((a, b) => a.ds.localeCompare(b.ds)) });
  };
  const del = (ds: string) => {
    const w = { ...weekData };
    delete w[`tip_${ds}`];
    delete w[`ot_${ds}`];
    updateWeek(weekKeyCur, { ...w, schedule: sched.filter((s) => s.ds !== ds) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Schedule</h1>
          <p className="text-white/40 text-sm mt-0.5">Build the week you&apos;re working.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2 py-1">
          <button onClick={() => setWeekKeyCur(offsetWeekKey(weekKeyCur, -1))} className="text-white/50 hover:text-white p-0.5 transition-colors"><Icon name="chevL" size={15} /></button>
          <span className="text-xs text-white/70 px-1 whitespace-nowrap">{weekRangeLabel(weekKeyCur)}{isCurrent && <em className="not-italic text-white ml-1">· this week</em>}</span>
          <button onClick={() => setWeekKeyCur(offsetWeekKey(weekKeyCur, 1))} className="text-white/50 hover:text-white p-0.5 transition-colors"><Icon name="chevR" size={15} /></button>
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        <Card className="col-span-full lg:col-span-2">
          <CardHead title="Add a shift" />
          <div className="flex gap-2 flex-wrap mb-4">
            {SC_DAYS.map(([l, v]) => (
              <button key={v} onClick={() => setDow(v)}
                className={cn('px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                  dow === v ? 'bg-white text-black border-transparent' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30 hover:text-white'
                )}>{l}</button>
            ))}
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-white/40 font-medium">Start</label>
              <input value={start} onChange={(e) => setStart(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors w-28" />
            </div>
            <span className="text-white/30 pb-2">→</span>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-white/40 font-medium">End</label>
              <input value={end} onChange={(e) => setEnd(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors w-28" />
            </div>
            <span className="text-white/40 text-sm pb-2">{hrs}h</span>
            <button onClick={add} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors">
              <Icon name="plus" size={15} /> Add
            </button>
          </div>
        </Card>
        <Card>
          <CardHead title="This week" sub={`${sched.length} shift${sched.length === 1 ? '' : 's'} · ${sched.reduce((s, x) => s + x.hours, 0)}h`} />
          <div className="flex flex-col gap-2.5 mt-1">
            {sched.length === 0 && <p className="text-white/30 text-sm">No shifts yet.</p>}
            {sched.map((s) => {
              const logged = weekData[`tip_${s.ds}`] != null;
              return (
                <div key={s.ds} className="flex items-center gap-2 text-sm">
                  <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs font-medium shrink-0">{s.label}</span>
                  <span className="text-white/40 text-xs flex-1">{s.start} – {s.end}</span>
                  <span className={cn('text-xs font-semibold shrink-0', logged ? 'text-white' : 'text-white/30')}>
                    {logged ? fmtCur0(weekData[`tip_${s.ds}`] as number, currency) : 'pending'}
                  </span>
                  <button onClick={() => del(s.ds)} className="text-white/20 hover:text-white/60 transition-colors shrink-0"><Icon name="x" size={14} /></button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---- Settings --------------------------------------------------------------
function SettingsView({ tweaks, setTweak, onSignOut, account, onReset }: {
  tweaks: Tweaks; setTweak: (k: keyof Tweaks, v: unknown) => void;
  onSignOut: () => void; account: { name: string; email: string; role: string }; onReset: () => void;
}) {
  const [wageStr, setWageStr] = useState(String(tweaks.wage));
  const [goalStr, setGoalStr] = useState(String(tweaks.goal));
  useEffect(() => setWageStr(String(tweaks.wage)), [tweaks.wage]);
  useEffect(() => setGoalStr(String(tweaks.goal)), [tweaks.goal]);
  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-white/40 text-sm mt-0.5">Pay, goals, and account.</p>
      </div>
      <Card>
        <CardHead title="Account" />
        <div className="flex items-center gap-4 mt-1">
          <Avatar name={account.name} size={48} />
          <div>
            <div className="font-bold text-white">{account.name}</div>
            <div className="text-sm text-white/40">{account.email}</div>
            <div className="text-sm text-white/40">{account.role}</div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHead title="Pay" />
        <label className="block text-[11px] text-white/40 font-medium mb-1.5">Hourly wage</label>
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-4 focus-within:border-white/30 transition-colors">
          <span className="text-white font-bold mr-2">{tweaks.currency}</span>
          <input value={wageStr} inputMode="decimal" onChange={(e) => setWageStr(e.target.value)}
            onBlur={() => { const v = parseFloat(wageStr); if (!isNaN(v) && v > 0) setTweak('wage', Math.round(v * 2) / 2); }}
            className="flex-1 bg-transparent text-white outline-none text-sm" />
        </div>
        <label className="block text-[11px] text-white/40 font-medium mb-2">Currency</label>
        <div className="flex gap-2">
          {['$', '£', '€'].map((sym) => <Pill key={sym} active={tweaks.currency === sym} onClick={() => setTweak('currency', sym)}>{sym}</Pill>)}
        </div>
      </Card>
      <Card>
        <CardHead title="Weekly goal" />
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-2 focus-within:border-white/30 transition-colors">
          <span className="text-white font-bold mr-2">{tweaks.currency}</span>
          <input value={goalStr} inputMode="decimal" onChange={(e) => setGoalStr(e.target.value)}
            onBlur={() => { const v = parseFloat(goalStr); if (!isNaN(v) && v > 0) setTweak('goal', Math.round(v)); }}
            className="flex-1 bg-transparent text-white outline-none text-sm" />
        </div>
        <p className="text-xs text-white/40">Combined target for tips + wage each week.</p>
      </Card>
      <Card>
        <CardHead title="Data" />
        <div className="flex gap-2 flex-wrap">
          <button onClick={onReset} className="px-4 py-2 rounded-xl border border-white/15 text-white/60 text-sm hover:border-white/30 hover:text-white transition-colors">Reset demo data</button>
          <button onClick={onSignOut} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors">
            <Icon name="logout" size={15} /> Sign out
          </button>
        </div>
      </Card>
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
  const onReset = useCallback(() => setState({ weeks: buildSeed(), auth: { signedIn: true, onboarded: true }, account: DEFAULT_ACCOUNT, tweaks: DEFAULT_TWEAKS }), []);
  const { wage, currency, goal } = state.tweaks;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <EtherealBackground color="rgba(255,255,255,0.6)" animation={{ scale: 35, speed: 40 }} />
      {/* Top nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-6 py-3 border-b border-white/[0.06] bg-[#0a0a0a]/85 backdrop-blur-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-[28px] h-[28px] rounded-[8px] border border-white/25 flex items-center justify-center flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M6.5 1.25L11.75 11H1.25L6.5 1.25Z" stroke="white" strokeWidth="1.25" strokeLinejoin="round"/>
              <line x1="3.25" y1="8" x2="9.75" y2="8" stroke="white" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
          </div>
          <span
            style={{ fontFamily: 'var(--font-fraunces)', fontStyle: 'italic', fontWeight: 700, letterSpacing: '-0.025em' }}
            className="text-white text-[18px] leading-none select-none"
          >
            Aphex
          </span>
        </div>

        {/* Desktop nav */}
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

        {/* Avatar → Settings */}
        <button
          onClick={() => setNav('settings')}
          title="Settings"
          className={cn(
            'flex items-center gap-2 rounded-full transition-all duration-200 outline-none',
            nav === 'settings'
              ? 'ring-1 ring-white/40 ring-offset-2 ring-offset-[#0a0a0a]'
              : 'hover:ring-1 hover:ring-white/20 hover:ring-offset-2 hover:ring-offset-[#0a0a0a]'
          )}
        >
          <span className="text-sm text-white/50 hidden sm:block pr-0.5">{state.account.name}</span>
          <Avatar name={state.account.name} size={30} />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 max-w-5xl w-full mx-auto">
        {nav === 'dashboard' && (
          <DashboardView weekKeyCur={weekKeyCur} setWeekKeyCur={setWeekKeyCur}
            weekData={weekData} wage={wage} currency={currency} goal={goal}
            updateWeek={updateWeek} account={state.account} />
        )}
        {nav === 'earnings' && <EarningsView allWeeks={state.weeks} weekKeyCur={weekKeyCur} wage={wage} currency={currency} />}
        {nav === 'schedule' && <ScheduleView weekKeyCur={weekKeyCur} setWeekKeyCur={setWeekKeyCur} weekData={weekData} wage={wage} currency={currency} updateWeek={updateWeek} />}
        {nav === 'settings' && <SettingsView tweaks={state.tweaks} setTweak={setTweak} onSignOut={onSignOut} account={state.account} onReset={onReset} />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-10 border-t border-white/[0.08] bg-[#0a0a0a]/90 backdrop-blur-md flex">
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
