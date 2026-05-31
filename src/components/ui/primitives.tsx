"use client";
import React from "react";
import { cn } from "@/lib/utils";

// ---- Icon ------------------------------------------------------------------
const PATHS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  calendar: 'M3 5h18v16H3zM3 9h18M8 3v4M16 3v4',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7 1.1V21a2 2 0 11-4 0v-.1A1.6 1.6 0 004.6 19l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.6 1.6 0 002 13.6H2a2 2 0 110-4h.1A1.6 1.6 0 003.5 7a1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.6 1.6 0 009 3.5a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1A1.6 1.6 0 0019 4.6l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00.3 1.8V9a2 2 0 110 4h-.1z',
  chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14', check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12',
  arrowR: 'M5 12h14M13 6l6 6-6 6', clock: 'M12 7v5l3 2', dots: 'M5 12h.01M12 12h.01M19 12h.01',
  coffee: 'M4 8h13v5a4 4 0 01-4 4H8a4 4 0 01-4-4zM17 9h2a2 2 0 110 4h-2M7 4v1M11 3v2M15 4v1',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 12h.01',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  lock: 'M7 11V7a5 5 0 0110 0v4M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z',
  flame: 'M12 3c2 3 4 4.5 4 8a4 4 0 01-8 0c0-1.5.5-2.5 1-3 .5 2 1.5 2.5 1.5 2.5S11 9 12 3z',
};

export function Icon({ name, size = 18, stroke = 1.6, className }: { name: string; size?: number; stroke?: number; className?: string }) {
  const fill = name === 'flame';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d={PATHS[name] ?? ''} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} />
    </svg>
  );
}

// ---- Card ------------------------------------------------------------------
export function Card({ children, light, accent, className = '', style, onClick }: {
  children: React.ReactNode; light?: boolean; accent?: boolean;
  className?: string; style?: React.CSSProperties; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'rounded-[18px] p-5 relative border backdrop-blur-sm',
        light ? 'bg-white/[0.14] border-white/15' : accent ? 'bg-white/[0.10] border-white/20' : 'bg-white/[0.09] border-white/10',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 mb-3">
      <div>
        <div className="text-[13px] font-semibold text-white/80">{title}</div>
        {sub && <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

export function Pill({ children, active, onClick, sm }: { children: React.ReactNode; active?: boolean; onClick?: () => void; sm?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full border font-medium transition-colors',
        sm ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        active ? 'bg-white text-black border-transparent' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30 hover:text-white'
      )}
    >
      {children}
    </button>
  );
}

export function Segmented({ options, value, onChange, sm }: {
  options: { v: string; l: string }[]; value: string; onChange: (v: string) => void; sm?: boolean;
}) {
  return (
    <div className={cn('flex items-center bg-white/5 border border-white/10 rounded-full p-0.5', sm && 'text-[11px]')}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={cn('rounded-full px-2.5 py-0.5 transition-colors font-medium',
            value === o.v ? 'bg-white text-black' : 'text-white/50 hover:text-white'
          )}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

// ---- Bars ------------------------------------------------------------------
export function Bars({ data, height = 110, accentIndex = -1, labels }: {
  data: number[]; height?: number; accentIndex?: number; labels?: string[];
}) {
  const mx = Math.max(1, ...data);
  return (
    <div className="mt-3">
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div
              className={cn('rounded-t-sm rounded-b-[2px] transition-all duration-300',
                i === accentIndex ? 'bg-white' : v === 0 ? 'bg-white/[0.08]' : 'bg-white/35'
              )}
              style={{ height: `${Math.max(8, (v / mx) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="flex gap-1.5 mt-1.5">
          {labels.map((l, i) => (
            <div key={i} className={cn('flex-1 text-center text-[10px]', i === accentIndex ? 'text-white font-bold' : 'text-white/30')}>
              {l}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Ring ------------------------------------------------------------------
export function Ring({ pct, size = 92, label, value }: { pct: number; size?: number; label?: string; value?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {/* energy ring */}
      <div className="absolute rounded-full border border-white/20 animate-[spin_4s_linear_infinite]"
        style={{ inset: -7, animationName: 'spin' }} />
      <svg width={size} height={size} className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={9} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeWidth={9}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-white leading-none">{value}</span>
        {label && <span className="text-[10px] text-white/40 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}

// ---- Avatar ----------------------------------------------------------------
export function Avatar({ name = 'M', size = 32 }: { name?: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <span className="rounded-full bg-white/20 text-white font-bold inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </span>
  );
}

// ---- Modal -----------------------------------------------------------------
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-white text-sm">{title}</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
