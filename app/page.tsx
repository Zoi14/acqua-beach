'use client';

import { useState, useEffect } from 'react';

// ── Design tokens (ACQUA palette) ──────────────────────────
const C = {
  navy:       '#0d2b3e',
  navyLight:  '#1a4a63',
  teal:       '#1a6b7c',
  tealLight:  '#2a8fa4',
  gold:       '#c9a84c',
  goldLight:  '#e4c46e',
  cream:      '#f7f3ee',
  sand:       '#e8ddd0',
  sandDark:   '#d4c4b0',
  white:      '#ffffff',
  text:       '#1a2e3a',
  textMuted:  '#5a7a8a',
  textLight:  '#8fa8b5',
};

// ── Types ──────────────────────────────────────────────────
type UmbrellaStatus = 'free' | 'occupied' | 'reserved';

interface HistoryEntry {
  id: string;
  umbrellaNumber: number;
  premium: boolean;
  customerName?: string;
  people?: number;
  arrivalTime?: string;
  departureTime: string;
  notes?: string;
  date: string; // YYYY-MM-DD
}

interface Umbrella {
  id: string;
  number: number;
  row: number;
  col: number;
  status: UmbrellaStatus;
  premium: boolean;
  people?: number;
  customerName?: string;
  arrivalTime?: string;
  notes?: string;
}

// 37 umbrellas: 4×8 + 1×5. Premium: col=1 in rows 1-4, ALL in row 5
const ROW_COUNTS = [8, 8, 8, 8, 5];
const PRICE_PER_HOUR = 5;
const BOSS_PASSWORD = 'boss123';

const STATUS = {
  free:     { label: 'Ελεύθερη',     color: '#2ecc71', bg: '#eafaf1', border: '#a9dfbf', text: '#1a7a40' },
  occupied: { label: 'Κατειλημμένη', color: '#e74c3c', bg: '#fdf0ef', border: '#f1948a', text: '#922b21' },
  reserved: { label: 'Κρατημένη',    color: C.gold,    bg: '#fdf8ec', border: C.goldLight, text: '#7d6025' },
};

function generateUmbrellas(): Umbrella[] {
  const out: Umbrella[] = [];
  let n = 1;
  ROW_COUNTS.forEach((count, ri) => {
    const row = ri + 1;
    const lastRow = row === ROW_COUNTS.length;
    for (let c = 1; c <= count; c++) {
      out.push({ id: `${row}-${c}`, number: n++, row, col: c, status: 'free', premium: lastRow || c === 1 });
    }
  });
  return out;
}

function getNow() {
  return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}

function getToday() {
  return new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function logHistory(u: Umbrella, prev: HistoryEntry[]): HistoryEntry[] {
  if (u.status === 'free' || !u.arrivalTime) return prev;
  const entry: HistoryEntry = {
    id: `${Date.now()}`,
    umbrellaNumber: u.number,
    premium: u.premium,
    customerName: u.customerName,
    people: u.people,
    arrivalTime: u.arrivalTime,
    departureTime: getNow(),
    notes: u.notes,
    date: getToday(),
  };
  const next = [entry, ...prev].slice(0, 200);
  localStorage.setItem('acqua-history', JSON.stringify(next));
  return next;
}

// ── Page ───────────────────────────────────────────────────
export default function BeachPage() {
  const [umbrellas, setUmbrellas]   = useState<Umbrella[]>(() => generateUmbrellas());
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected]     = useState<Umbrella | null>(null);
  const [role, setRole]             = useState<'employee' | 'boss'>('employee');
  const [showLogin, setShowLogin]   = useState(false);
  const [password, setPassword]     = useState('');
  const [loginError, setLoginError] = useState('');
  const [clock, setClock]           = useState('');

  useEffect(() => {
    document.title = 'ACQUA Beach | Ομπρέλες';
    const saved = localStorage.getItem('acqua-beach-v1');
    if (saved) {
      try {
        const p = JSON.parse(saved) as Umbrella[];
        if (p[0]?.premium !== undefined) {
          // Ensure row 5 is always all-premium (fix stale data)
          const fixed = p.map(u => ({ ...u, premium: u.row === 5 ? true : u.premium }));
          setUmbrellas(fixed);
        }
      } catch {}
    }
    const savedHistory = localStorage.getItem('acqua-history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (umbrellas.length) localStorage.setItem('acqua-beach-v1', JSON.stringify(umbrellas));
  }, [umbrellas]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const stats = {
    total:    umbrellas.length,
    free:     umbrellas.filter(u => u.status === 'free').length,
    occupied: umbrellas.filter(u => u.status === 'occupied').length,
    reserved: umbrellas.filter(u => u.status === 'reserved').length,
    people:   umbrellas.reduce((s, u) => s + (u.people || 0), 0),
  };
  const occupancy = Math.round(((stats.occupied + stats.reserved) / stats.total) * 100);

  const quickToggle = (u: Umbrella, e: React.MouseEvent) => {
    e.stopPropagation();
    const next: UmbrellaStatus = u.status === 'free' ? 'occupied' : 'free';
    if (next === 'free') setHistory(prev => logHistory(u, prev));
    setUmbrellas(prev => prev.map(x => x.id === u.id
      ? { ...x, status: next, arrivalTime: next === 'occupied' ? getNow() : undefined, customerName: next === 'free' ? undefined : x.customerName, people: next === 'free' ? undefined : x.people }
      : x));
  };

  const handleStatusChange = (s: UmbrellaStatus) => {
    setSelected(prev => prev ? {
      ...prev, status: s,
      arrivalTime: s !== 'free' ? (prev.arrivalTime || getNow()) : undefined,
    } : null);
  };

  const handleSave = () => {
    if (!selected) return;
    const prev = umbrellas.find(u => u.id === selected.id);
    if (prev && prev.status !== 'free' && selected.status === 'free') {
      setHistory(h => logHistory(prev, h));
    }
    setUmbrellas(prev => prev.map(u => u.id === selected.id ? { ...selected } : u));
    setSelected(null);
  };

  const resetDay = () => {
    if (!confirm('Επαναφορά ΟΛΩΝ σε ελεύθερες;')) return;
    setUmbrellas(prev => prev.map(u => ({ ...u, status: 'free', customerName: undefined, arrivalTime: undefined, notes: undefined })));
  };

  const handleLogin = () => {
    if (password === BOSS_PASSWORD) { setRole('boss'); setShowLogin(false); setPassword(''); setLoginError(''); }
    else setLoginError('Λάθος κωδικός');
  };

  const rowMap: Record<number, Umbrella[]> = {};
  umbrellas.forEach(u => { rowMap[u.row] = rowMap[u.row] || []; rowMap[u.row].push(u); });
  const rows = Object.keys(rowMap).map(Number).sort();
  const occupiedList = umbrellas.filter(u => u.status !== 'free');

  return (
    <div style={{ minHeight: '100vh', background: C.cream, fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif", color: C.text }}>

      {/* ── NAVBAR ── */}
      <nav style={{ background: C.navy, borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>

          {/* Logo area */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ color: C.gold, fontWeight: 800, fontSize: 20, letterSpacing: '4px', lineHeight: 1, textTransform: 'uppercase' }}>ACQUA</span>
              <span style={{ color: C.textLight, fontSize: 8, letterSpacing: '2.5px', textTransform: 'uppercase', lineHeight: 1, marginTop: 2 }}>Beach Bar Since 1999</span>
            </div>
            <div style={{ width: 1, height: 28, background: 'rgba(201,168,76,0.3)', margin: '0 4px' }} />
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Ομπρέλες</span>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: C.gold, fontFamily: 'monospace', fontSize: 13, letterSpacing: 1, fontWeight: 600 }}>{clock}</div>
            {role === 'boss' && (
              <>
                <button onClick={() => setShowHistory(h => !h)}
                  style={{ background: showHistory ? `rgba(201,168,76,0.15)` : 'transparent', border: `1px solid rgba(201,168,76,0.4)`, color: C.gold, borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.5px' }}>
                  ΙΣΤΟΡΙΚΟ {history.length > 0 && `(${history.length})`}
                </button>
                <button onClick={resetDay}
                  style={{ background: 'transparent', border: `1px solid rgba(231,76,60,0.4)`, color: '#e74c3c', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, letterSpacing: '0.5px' }}>
                  RESET
                </button>
              </>
            )}
            <button
              onClick={() => role === 'employee' ? setShowLogin(true) : setRole('employee')}
              style={{ background: role === 'boss' ? 'transparent' : `linear-gradient(135deg,${C.gold},${C.goldLight})`, border: `1px solid ${C.gold}`, color: role === 'boss' ? C.gold : C.navy, borderRadius: 6, padding: '6px 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              {role === 'boss' ? 'ΠΡΟΣΩΠΙΚΟ' : 'MANAGEMENT'}
            </button>
          </div>
        </div>
      </nav>

      {/* ── STATS ── */}
      <div style={{ background: C.navyLight, borderBottom: `1px solid rgba(201,168,76,0.2)` }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'ΣΥΝΟΛΟ',        value: stats.total,    color: C.gold,    sub: 'ομπρέλες' },
              { label: 'ΕΛΕΥΘΕΡΕΣ',     value: stats.free,     color: '#2ecc71', sub: 'διαθέσιμες' },
              { label: 'ΚΑΤΕΙΛΗΜΜΕΝΕΣ', value: stats.occupied, color: '#e74c3c', sub: 'σε χρήση' },
              { label: 'ΚΡΑΤΗΜΕΝΕΣ',    value: stats.reserved, color: C.goldLight, sub: 'κράτηση' },
              { label: 'ΑΤΟΜΑ',         value: stats.people,   color: C.tealLight,  sub: 'στην παραλία' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 8px', textAlign: 'center', border: `1px solid rgba(255,255,255,0.08)` }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.8px', whiteSpace: 'nowrap' }}>Πληρότητα</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${occupancy}%`, background: `linear-gradient(90deg,${C.gold},${C.goldLight})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.gold, minWidth: 36, textAlign: 'right' }}>{occupancy}%</span>
          </div>
        </div>
      </div>

      {/* ── BEACH MAP ── */}
      <div style={{ padding: '20px 12px 40px', maxWidth: 1100, margin: '0 auto' }}>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {(Object.entries(STATUS) as [UmbrellaStatus, typeof STATUS['free']][]).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.white, borderRadius: 99, padding: '4px 12px', border: `1px solid ${cfg.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
              <span style={{ fontSize: 11, color: cfg.text, fontWeight: 700, letterSpacing: '0.3px' }}>{cfg.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.white, borderRadius: 99, padding: '4px 12px', border: `1px solid ${C.goldLight}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 10 }}>⭐</span>
            <span style={{ fontSize: 11, color: '#7d6025', fontWeight: 700 }}>Premium</span>
          </div>
          <span style={{ fontSize: 10, color: C.textLight, marginLeft: 4 }}>Κλικ → λεπτομέρειες</span>
        </div>

        {/* ── SEA ── */}
        <div style={{ borderRadius: '20px 20px 0 0', overflow: 'hidden', marginBottom: 0 }}>
          <div style={{ background: `linear-gradient(180deg, #0a4a6e 0%, #0e6b94 40%, #1a8ab0 70%, #38a8cc 100%)`, padding: '18px 16px 22px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Wave lines */}
            {[0,1,2].map(i => (
              <div key={i} style={{ position: 'absolute', bottom: i * 7, left: 0, right: 0, height: 2, background: `rgba(255,255,255,${0.06 + i * 0.04})`, borderRadius: 99 }} />
            ))}
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 800, letterSpacing: '5px', textTransform: 'uppercase', position: 'relative', zIndex: 1 }}>
              〰 ΘΑΛΑΣΣΑ 〰
            </span>
          </div>
          {/* Wave border */}
          <div style={{ height: 12, background: `linear-gradient(180deg,#38a8cc,${C.sand})`, opacity: 0.6 }} />
        </div>

        {/* ── BEACH GRID ── */}
        <div style={{ background: `linear-gradient(180deg,#eee0c9 0%,${C.sand} 50%,${C.sandDark} 100%)`, boxShadow: `0 6px 24px rgba(13,43,62,0.15)`, borderBottom: `2px solid ${C.sandDark}`, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '14px 16px', minWidth: 'max-content', justifyContent: 'center' }}>

            {/* Σ1–Σ4 */}
            {[1,2,3,4].map(r => (
              <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 800, color: C.navyLight, background: 'rgba(255,255,255,0.7)', borderRadius: 5, padding: '2px 6px', letterSpacing: '0.5px', border: `1px solid rgba(26,74,99,0.12)` }}>
                  Σ{r}
                </div>
                {(rowMap[r] || []).map(u => (
                  <UmbrellaCell key={u.id} umbrella={u}
                    onClick={() => setSelected({ ...u })}
                    onContextMenu={e => { e.preventDefault(); quickToggle(u, e); }}
                  />
                ))}
              </div>
            ))}

            {/* Διαχωριστής */}
            <div style={{ width: 1, alignSelf: 'stretch', background: `linear-gradient(180deg,transparent,${C.gold}66,transparent)`, margin: '0 4px', flexShrink: 0 }} />

            {/* Σ5 Premium */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'absolute', inset: '-8px -6px', borderRadius: 14, border: `1.5px solid ${C.gold}88`, background: `linear-gradient(180deg,rgba(201,168,76,0.12),rgba(201,168,76,0.04))`, pointerEvents: 'none', zIndex: 0 }} />
              <div style={{ position: 'relative', zIndex: 1, background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: C.navy, fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: 5, letterSpacing: '1px', textTransform: 'uppercase', whiteSpace: 'nowrap', boxShadow: `0 2px 6px rgba(201,168,76,0.4)` }}>
                ⭐ VIP
              </div>
              {(rowMap[5] || []).map(u => (
                <UmbrellaCell key={u.id} umbrella={u}
                  onClick={() => setSelected({ ...u })}
                  onContextMenu={e => { e.preventDefault(); quickToggle(u, e); }}
                />
              ))}
            </div>

          </div>
        </div>

        {/* ── BAR ── */}
        <div style={{ background: C.navy, borderRadius: '0 0 20px 20px', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: `0 8px 24px rgba(13,43,62,0.25)` }}>
          <span style={{ color: C.gold, fontSize: 16 }}>🍹</span>
          <span style={{ color: C.gold, fontSize: 9, fontWeight: 800, letterSpacing: '4px', textTransform: 'uppercase' }}>BAR · ΕΙΣΟΔΟΣ</span>
          <span style={{ color: C.gold, fontSize: 16 }}>🍹</span>
        </div>
      </div>

      {/* ── BOSS LIST ── */}
      {role === 'boss' && (
        <div style={{ maxWidth: 1100, margin: '0 auto 48px', padding: '0 12px' }}>
          <div style={{ background: C.white, borderRadius: 16, boxShadow: '0 4px 24px rgba(13,43,62,0.1)', overflow: 'hidden', border: `1px solid ${C.sand}` }}>
            <div style={{ background: C.navy, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, background: C.gold, borderRadius: 2 }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>Κατάσταση Ομπρελών</span>
              <span style={{ marginLeft: 'auto', background: 'rgba(201,168,76,0.2)', border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 99, padding: '2px 10px', fontSize: 11, color: C.gold, fontWeight: 700 }}>
                {occupiedList.length} / {stats.total}
              </span>
            </div>
            {occupiedList.length === 0
              ? <div style={{ padding: '32px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>Δεν υπάρχουν κατειλημμένες ή κρατημένες ομπρέλες</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
                    <thead>
                      <tr style={{ background: C.cream }}>
                        {['Ομπρέλα', 'Κατάσταση', 'Άτομα', 'Πελάτης', 'Ώρα', 'Σημειώσεις'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: C.navyLight, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `2px solid ${C.sand}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {occupiedList.map((u, i) => {
                        const cfg = STATUS[u.status];
                        return (
                          <tr key={u.id} style={{ borderBottom: i < occupiedList.length - 1 ? `1px solid ${C.cream}` : 'none' }}>
                            <td style={{ padding: '12px 16px', fontWeight: 800, color: C.navy }}>
                              {u.premium && <span style={{ color: C.gold, marginRight: 4 }}>⭐</span>}#{u.number}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {u.people ? (
                                <span style={{ background: C.navyLight, color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                  👤 {u.people}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '12px 16px', color: u.customerName ? C.text : C.textLight }}>{u.customerName || '—'}</td>
                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: u.arrivalTime ? C.teal : C.textLight, fontWeight: 700 }}>{u.arrivalTime || '—'}</td>
                            <td style={{ padding: '12px 16px', color: C.textMuted }}>{u.notes || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── HISTORY PANEL ── */}
      {role === 'boss' && showHistory && (
        <div style={{ maxWidth: 1100, margin: '0 auto 40px', padding: '0 12px' }}>
          <div style={{ background: C.white, borderRadius: 16, boxShadow: '0 4px 24px rgba(13,43,62,0.1)', overflow: 'hidden', border: `1px solid ${C.sand}` }}>
            <div style={{ background: C.navy, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 3, height: 18, background: C.gold, borderRadius: 2 }} />
              <span style={{ color: C.white, fontWeight: 700, fontSize: 13, letterSpacing: '1px', textTransform: 'uppercase' }}>Ιστορικό Ημέρας</span>
              <span style={{ color: C.textLight, fontSize: 11, marginLeft: 4 }}>{getToday()}</span>
              {history.length > 0 && (
                <button onClick={() => { if (confirm('Διαγραφή ιστορικού;')) { setHistory([]); localStorage.removeItem('acqua-history'); } }}
                  style={{ marginLeft: 'auto', background: 'transparent', border: `1px solid rgba(231,76,60,0.35)`, color: '#e74c3c', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  Διαγραφή
                </button>
              )}
            </div>
            {history.length === 0
              ? <div style={{ padding: '32px', textAlign: 'center', color: C.textLight, fontSize: 13 }}>Δεν υπάρχουν καταχωρήσεις ακόμα</div>
              : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                    <thead>
                      <tr style={{ background: C.cream }}>
                        {['#', 'Ομπρέλα', 'Άτομα', 'Πελάτης', 'Άφιξη', 'Αναχώρηση', 'Σημειώσεις'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: C.navyLight, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: `2px solid ${C.sand}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((e, i) => (
                        <tr key={e.id} style={{ borderBottom: i < history.length - 1 ? `1px solid ${C.cream}` : 'none', background: i % 2 === 0 ? C.white : C.cream }}>
                          <td style={{ padding: '11px 14px', color: C.textLight, fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '11px 14px', fontWeight: 800, color: C.navy }}>
                            {e.premium && <span style={{ color: C.gold, marginRight: 4 }}>⭐</span>}#{e.umbrellaNumber}
                          </td>
                          <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                            {e.people ? <span style={{ background: C.navyLight, color: '#fff', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>👤 {e.people}</span> : '—'}
                          </td>
                          <td style={{ padding: '11px 14px', color: e.customerName ? C.text : C.textLight }}>{e.customerName || '—'}</td>
                          <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: C.teal, fontWeight: 700 }}>{e.arrivalTime || '—'}</td>
                          <td style={{ padding: '11px 14px', fontFamily: 'monospace', color: '#e74c3c', fontWeight: 700 }}>{e.departureTime}</td>
                          <td style={{ padding: '11px 14px', color: C.textMuted }}>{e.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ── UMBRELLA MODAL ── */}
      {selected && (
        <Overlay onClose={() => setSelected(null)}>
          <div style={{ width: 'min(92vw,360px)' }}>
            {/* Modal header */}
            <div style={{ background: C.navy, borderRadius: '16px 16px 0 0', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${C.gold}` }}>
              <div>
                <div style={{ color: C.gold, fontWeight: 800, fontSize: 18, letterSpacing: '-0.3px' }}>
                  ☂ Ομπρέλα #{selected.number}
                  {selected.premium && <span style={{ marginLeft: 8, fontSize: 14 }}>⭐</span>}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2, letterSpacing: '0.5px' }}>
                  Σειρά {selected.row} · Θέση {selected.col}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 18, width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Status */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Κατάσταση</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(Object.keys(STATUS) as UmbrellaStatus[]).map(s => {
                    const cfg = STATUS[s];
                    const active = selected.status === s;
                    return (
                      <button key={s} onClick={() => handleStatusChange(s)} style={{
                        flex: 1, padding: '11px 4px', borderRadius: 10, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        border: `2px solid ${active ? cfg.color : C.sand}`,
                        background: active ? cfg.bg : C.cream,
                        color: active ? cfg.text : C.textLight,
                        boxShadow: active ? `0 0 0 3px ${cfg.color}18` : 'none',
                        transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.3px',
                      }}>
                        <div style={{ fontSize: 18, marginBottom: 3 }}>{s === 'free' ? '✓' : s === 'occupied' ? '●' : '◑'}</div>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Premium toggle (boss only) */}
              {role === 'boss' && (
                <div style={{ marginBottom: 16 }}>
                  <button onClick={() => setSelected(p => p ? { ...p, premium: !p.premium } : null)} style={{
                    width: '100%', padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: `2px solid ${selected.premium ? C.gold : C.sand}`,
                    background: selected.premium ? '#fdf8ec' : C.cream,
                    color: selected.premium ? '#7d6025' : C.textLight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '0.5px', textTransform: 'uppercase',
                  }}>
                    {selected.premium ? '⭐ Premium ομπρέλα' : '☆ Κανονική ομπρέλα'}
                  </button>
                </div>
              )}

              {selected.status !== 'free' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Ώρα Άφιξης</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="time" value={selected.arrivalTime || ''} onChange={e => setSelected(p => p ? { ...p, arrivalTime: e.target.value } : null)} style={{ ...inp, flex: 1 }} />
                      <button onClick={() => setSelected(p => p ? { ...p, arrivalTime: getNow() } : null)}
                        style={{ background: `linear-gradient(135deg,${C.teal},${C.tealLight})`, color: C.white, border: 'none', borderRadius: 10, padding: '0 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        Τώρα
                      </button>
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Όνομα Πελάτη</label>
                    <input placeholder="π.χ. Παπαδόπουλος" value={selected.customerName || ''} onChange={e => setSelected(p => p ? { ...p, customerName: e.target.value } : null)} style={inp} />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={lbl}>Αριθμός Ατόμων</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1.5px solid ${C.sand}`, borderRadius: 10, overflow: 'hidden', background: C.cream }}>
                      <button onClick={() => setSelected(p => p ? { ...p, people: Math.max(1, (p.people || 1) - 1) } : null)}
                        style={{ width: 44, height: 44, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.navyLight, fontWeight: 700, flexShrink: 0 }}>−</button>
                      <div style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 800, color: C.navy }}>{selected.people || 1}</div>
                      <button onClick={() => setSelected(p => p ? { ...p, people: (p.people || 1) + 1 } : null)}
                        style={{ width: 44, height: 44, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.navyLight, fontWeight: 700, flexShrink: 0 }}>+</button>
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={lbl}>Σημειώσεις</label>
                <textarea placeholder="VIP, παιδιά, σκιά..." value={selected.notes || ''} onChange={e => setSelected(p => p ? { ...p, notes: e.target.value } : null)} rows={2} style={{ ...inp, resize: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleSave} style={{ flex: 1, background: `linear-gradient(135deg,${C.navy},${C.navyLight})`, color: C.gold, border: `1px solid rgba(201,168,76,0.3)`, borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Αποθήκευση
                </button>
                <button onClick={() => setSelected(null)} style={{ padding: '13px 16px', background: C.cream, border: `1px solid ${C.sand}`, borderRadius: 10, color: C.textMuted, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ── BOSS LOGIN ── */}
      {showLogin && (
        <Overlay onClose={() => { setShowLogin(false); setPassword(''); setLoginError(''); }}>
          <div style={{ width: 'min(90vw,300px)' }}>
            <div style={{ background: C.navy, borderRadius: '16px 16px 0 0', padding: '28px 24px 20px', textAlign: 'center', borderBottom: `2px solid ${C.gold}` }}>
              <div style={{ color: C.gold, fontWeight: 800, fontSize: 22, letterSpacing: '4px', textTransform: 'uppercase' }}>ACQUA</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, letterSpacing: '2px', textTransform: 'uppercase', marginTop: 2 }}>Beach Bar Since 1999</div>
            </div>
            <div style={{ padding: '24px 24px 28px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.navy, marginBottom: 4, letterSpacing: '1px', textTransform: 'uppercase' }}>Είσοδος Αφεντικού</div>
              <div style={{ color: C.textLight, fontSize: 12, marginBottom: 20 }}>Εισάγετε τον κωδικό σας</div>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoFocus
                style={{ ...inp, textAlign: 'center', fontSize: 20, letterSpacing: 8, marginBottom: 8 }} />
              {loginError && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 8 }}>{loginError}</div>}
              <button onClick={handleLogin} style={{ width: '100%', background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: C.navy, border: 'none', borderRadius: 10, padding: '13px', fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 4 }}>
                Είσοδος
              </button>
              <div style={{ color: C.textLight, fontSize: 10, marginTop: 14, letterSpacing: '0.5px' }}>Demo: boss123</div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ── UmbrellaCell ───────────────────────────────────────────
function UmbrellaCell({ umbrella, onClick, onContextMenu }: {
  umbrella: Umbrella;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS[umbrella.status];

  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`#${umbrella.number} — ${cfg.label}${umbrella.customerName ? ` · ${umbrella.customerName}` : ''}${umbrella.arrivalTime ? ` · ${umbrella.arrivalTime}` : ''}`}
      style={{
        position: 'relative',
        width: 46, height: 54,
        borderRadius: 10,
        border: umbrella.premium
          ? `2px solid ${hovered ? C.gold : 'rgba(201,168,76,0.55)'}`
          : `2px solid ${hovered ? cfg.color : cfg.border}`,
        background: umbrella.premium
          ? `linear-gradient(160deg,#fdf8ec,${cfg.bg})`
          : `linear-gradient(160deg,#fff,${cfg.bg})`,
        boxShadow: hovered
          ? `0 6px 16px ${cfg.color}55`
          : umbrella.status !== 'free'
            ? `0 2px 8px ${cfg.color}33`
            : '0 1px 4px rgba(13,43,62,0.1)',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        transform: hovered ? 'translateY(-3px) scale(1.07)' : 'none',
        transition: 'transform 0.15s, box-shadow 0.15s',
        flexShrink: 0, padding: 0,
      }}
    >
      <div style={{ fontSize: 17, lineHeight: 1 }}>☂️</div>
      <div style={{
        background: cfg.color, color: '#fff',
        fontSize: umbrella.number > 9 ? 8 : 10,
        fontWeight: 800, width: 19, height: 19, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 1px 3px ${cfg.color}55`, lineHeight: 1,
      }}>
        {umbrella.number}
      </div>
      {umbrella.premium && (
        <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 9, lineHeight: 1 }}>⭐</div>
      )}
      {umbrella.customerName && (
        <div style={{ position: 'absolute', top: -5, left: -5, width: 14, height: 14, background: C.navy, borderRadius: '50%', border: `2px solid ${C.white}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 800, color: C.gold }}>
          {umbrella.customerName[0].toUpperCase()}
        </div>
      )}
      {umbrella.status === 'occupied' && umbrella.arrivalTime && (
        <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: C.navy, color: C.gold, fontSize: 6, fontWeight: 700, padding: '1px 5px', borderRadius: 3, whiteSpace: 'nowrap' }}>
          {umbrella.arrivalTime}{umbrella.people ? ` ·${umbrella.people}👤` : ''}
        </div>
      )}
    </button>
  );
}

// ── Overlay ────────────────────────────────────────────────
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,43,62,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, boxShadow: `0 24px 80px rgba(13,43,62,0.4)`, maxWidth: '95vw', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

// ── Shared micro-styles ────────────────────────────────────
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: C.textMuted,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px',
};
const inp: React.CSSProperties = {
  width: '100%', border: `1.5px solid ${C.sand}`, borderRadius: 10,
  padding: '10px 12px', fontSize: 14, color: C.text, outline: 'none',
  background: C.cream, boxSizing: 'border-box', fontFamily: 'inherit',
};
