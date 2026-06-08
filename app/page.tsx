'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://owomepqgtxrmkylzmjgp.supabase.co',
  'sb_publishable_9IwPnnK_8PDjPjo6QR76kg_dsxFXQqP'
);

type UmbrellaStatus = 'free' | 'occupied' | 'reserved';

interface HistoryEntry {
  id: string;
  umbrella_number: number;
  premium: boolean;
  customer_name?: string;
  people?: number;
  arrival_time?: string;
  departure_time: string;
  notes?: string;
  date: string;
}

interface Umbrella {
  id: string;
  number: number;
  row_num: number;
  col_num: number;
  status: UmbrellaStatus;
  premium: boolean;
  people?: number;
  customer_name?: string;
  arrival_time?: string;
  notes?: string;
}

const ROW_COUNTS = [8, 8, 8, 8, 5];
const BOSS_PASSWORD = 'boss123';
const ALERT_HOURS = 3; // ειδοποίηση αν > 3 ώρες

const C = {
  navy: '#0d2b3e', navyLight: '#1a4a63', teal: '#1a6b7c',
  gold: '#c9a84c', goldLight: '#e4c46e', cream: '#f7f3ee', sand: '#e8ddd0',
  sandDark: '#d4c4b0', white: '#ffffff', text: '#1a2e3a',
  textMuted: '#5a7a8a', textLight: '#8fa8b5',
};

const STATUS = {
  free:     { label: 'Ελεύθερη',     color: '#2ecc71', bg: '#eafaf1', border: '#a9dfbf', text: '#1a7a40' },
  occupied: { label: 'Κατειλημμένη', color: '#e74c3c', bg: '#fdf0ef', border: '#f1948a', text: '#922b21' },
  reserved: { label: 'Κρατημένη',    color: C.gold,    bg: '#fdf8ec', border: C.goldLight, text: '#7d6025' },
};

// ── Time helpers ───────────────────────────────────────────────────────────────
function getNow() {
  return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}
function getToday() {
  return new Date().toLocaleDateString('el-GR');
}

/** Υπολογίζει λεπτά από "HH:MM" μέχρι τώρα */
function minutesSince(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date();
  const then = new Date();
  then.setHours(h, m, 0, 0);
  const diff = (now.getTime() - then.getTime()) / 60000;
  return diff < 0 ? diff + 24 * 60 : diff; // αν πέρασε μεσάνυχτα
}

/** Μορφοποιεί λεπτά → "1ω 20λ" */
function formatDuration(mins: number): string {
  if (mins < 60) return `${Math.floor(mins)}λ`;
  const h = Math.floor(mins / 60);
  const m = Math.floor(mins % 60);
  return m > 0 ? `${h}ω ${m}λ` : `${h}ω`;
}

/** Χρώμα βάσει διάρκειας */
function durationColor(mins: number): { bg: string; border: string; text: string; label: string } {
  if (mins < 60)  return { bg: '#eafaf1', border: '#2ecc71', text: '#1a7a40', label: 'Νωρίς' };
  if (mins < 120) return { bg: '#fefce8', border: '#f59e0b', text: '#92400e', label: 'Μεσαία' };
  if (mins < 180) return { bg: '#fff7ed', border: '#f97316', text: '#7c2d12', label: 'Αρκετή' };
  return            { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d', label: 'Πολλή ώρα!' };
}

function generateInitialUmbrellas(): Umbrella[] {
  const out: Umbrella[] = [];
  let n = 1;
  ROW_COUNTS.forEach((count, ri) => {
    const row = ri + 1;
    const lastRow = row === ROW_COUNTS.length;
    for (let c = 1; c <= count; c++) {
      out.push({ id: `${row}-${c}`, number: n++, row_num: row, col_num: c, status: 'free', premium: lastRow || c === 1 });
    }
  });
  return out;
}

// ── Umbrella Cell ──────────────────────────────────────────────────────────────
function UmbrellaCell({ u, onTap, onQuickRelease, now }: {
  u: Umbrella;
  onTap: (u: Umbrella) => void;
  onQuickRelease: (u: Umbrella) => void;
  now: Date; // re-renders every minute
}) {
  const [hov, setHov] = useState(false);
  const busy = u.status !== 'free';
  const isOccupied = u.status === 'occupied';

  // Compute duration
  const mins = (isOccupied && u.arrival_time) ? minutesSince(u.arrival_time) : 0;
  const dur = (isOccupied && u.arrival_time) ? durationColor(mins) : null;
  const longStay = mins >= ALERT_HOURS * 60;

  // Base style: if occupied use duration color, else use status color
  const borderColor = hov
    ? (dur ? dur.border : STATUS[u.status].color)
    : (dur ? dur.border : STATUS[u.status].border);
  const bgColor = dur ? dur.bg : STATUS[u.status].bg;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => onTap(u)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: 62, height: 72, borderRadius: 14,
          border: `2px solid ${borderColor}`,
          background: hov ? borderColor + '28' : bgColor,
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '3px 2px', gap: 1, transition: 'all 0.15s',
          boxShadow: longStay
            ? `0 0 0 3px #dc262640, 0 4px 12px #dc262630`
            : hov ? `0 4px 14px ${borderColor}44` : '0 1px 4px rgba(0,0,0,0.08)',
          position: 'relative',
          animation: longStay ? 'pulse 2s infinite' : 'none',
        }}
      >
        {u.premium && (
          <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: C.gold }}>⭐</span>
        )}
        {/* Pulsing dot for long stays */}
        {longStay && (
          <span style={{ position: 'absolute', top: 2, left: 4, width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'block' }} />
        )}

        {/* Number badge */}
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: dur ? dur.border : STATUS[u.status].color,
          color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>{u.number}</div>

        {/* Icon */}
        <div style={{ fontSize: 14 }}>
          {u.status === 'occupied' ? '🏖️' : u.status === 'reserved' ? '📋' : '☂️'}
        </div>

        {/* Duration OR arrival time */}
        {isOccupied && u.arrival_time && (
          <div style={{ fontSize: 8, color: dur!.text, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
            ⏱{formatDuration(mins)}
          </div>
        )}
        {!isOccupied && u.status === 'reserved' && u.arrival_time && (
          <div style={{ fontSize: 8, color: STATUS.reserved.text, fontWeight: 600, textAlign: 'center' }}>
            {u.arrival_time}
          </div>
        )}
        {u.people && busy && (
          <div style={{ fontSize: 7, color: C.textMuted, fontWeight: 600 }}>{u.people}👤</div>
        )}
      </button>

      {/* Quick release × */}
      {busy && (
        <button
          onClick={e => { e.stopPropagation(); onQuickRelease(u); }}
          style={{
            position: 'absolute', top: -7, left: -7,
            width: 20, height: 20, borderRadius: '50%',
            background: '#e74c3c', color: '#fff',
            border: '2px solid #fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 5,
          }}
        >×</button>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BeachPage() {
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sync, setSync]           = useState<'ok'|'busy'|'err'>('ok');
  const [now, setNow]             = useState(new Date()); // ticks every minute

  const [selected, setSelected]       = useState<Umbrella | null>(null);
  const [modalStatus, setModalStatus] = useState<UmbrellaStatus>('free');
  const [modalName, setModalName]     = useState('');
  const [modalPeople, setModalPeople] = useState('');
  const [modalNotes, setModalNotes]   = useState('');

  const [isBoss, setIsBoss]     = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [bossPass, setBossPass]   = useState('');
  const [panelTab, setPanelTab]   = useState<'stats'|'history'|'timers'>('stats');

  const alertedRef = useRef<Set<string>>(new Set());

  // ── Clock: tick every minute ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // ── Alert for long stays ─────────────────────────────────────────────────────
  useEffect(() => {
    umbrellas.forEach(u => {
      if (u.status === 'occupied' && u.arrival_time) {
        const mins = minutesSince(u.arrival_time);
        if (mins >= ALERT_HOURS * 60 && !alertedRef.current.has(u.id)) {
          alertedRef.current.add(u.id);
          // Browser notification if permitted
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`⚠️ Ομπρέλα #${u.number} — ${formatDuration(mins)}!`, {
              body: `${u.customer_name || 'Ανώνυμος'} · Άφιξη ${u.arrival_time}`,
              icon: '/favicon.ico',
            });
          }
        }
        // Reset alert if umbrella freed
        if (u.status === 'free') alertedRef.current.delete(u.id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, umbrellas]);

  // ── Supabase helpers ─────────────────────────────────────────────────────────
  async function fetchUmbrellas() {
    const { data, error } = await supabase.from('umbrellas').select('*').order('number');
    if (error) { setSync('err'); setLoading(false); return; }
    if (!data || data.length === 0) {
      const init = generateInitialUmbrellas();
      await supabase.from('umbrellas').insert(init);
      setUmbrellas(init);
    } else {
      setUmbrellas(data as Umbrella[]);
    }
    setLoading(false);
  }

  async function fetchHistory() {
    const { data } = await supabase.from('history').select('*').order('created_at', { ascending: false }).limit(200);
    if (data) setHistory(data as HistoryEntry[]);
  }

  async function pushUpdate(u: Umbrella) {
    setSync('busy');
    const { error } = await supabase.from('umbrellas').update(u).eq('id', u.id);
    setSync(error ? 'err' : 'ok');
  }

  async function pushHistory(u: Umbrella) {
    if (!u.arrival_time) return;
    const entry: HistoryEntry = {
      id: `${Date.now()}`, umbrella_number: u.number, premium: u.premium,
      customer_name: u.customer_name, people: u.people,
      arrival_time: u.arrival_time, departure_time: getNow(),
      notes: u.notes, date: getToday(),
    };
    await supabase.from('history').insert(entry);
    setHistory(p => [entry, ...p].slice(0, 200));
  }

  // ── Real-time ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchUmbrellas();
    fetchHistory();
    // Ask for notification permission
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const ch = supabase.channel('beach-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'umbrellas' }, p => {
        setUmbrellas(prev => prev.map(u => u.id === p.new.id ? p.new as Umbrella : u));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'umbrellas' }, p => {
        setUmbrellas(prev => [...prev, p.new as Umbrella].sort((a, b) => a.number - b.number));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modal ────────────────────────────────────────────────────────────────────
  function openModal(u: Umbrella) {
    setSelected(u);
    setModalStatus(u.status);
    setModalName(u.customer_name || '');
    setModalPeople(u.people?.toString() || '');
    setModalNotes(u.notes || '');
  }

  async function saveModal() {
    if (!selected) return;
    if (selected.status !== 'free' && modalStatus === 'free') await pushHistory(selected);
    const updated: Umbrella = {
      ...selected, status: modalStatus,
      customer_name: modalStatus === 'free' ? undefined : (modalName || undefined),
      people:        modalStatus === 'free' ? undefined : (parseInt(modalPeople) || undefined),
      arrival_time:  modalStatus === 'free' ? undefined : (selected.arrival_time || getNow()),
      notes:         modalStatus === 'free' ? undefined : (modalNotes || undefined),
    };
    setUmbrellas(p => p.map(u => u.id === updated.id ? updated : u));
    setSelected(null);
    await pushUpdate(updated);
  }

  async function quickRelease(u: Umbrella) {
    await pushHistory(u);
    const updated: Umbrella = { ...u, status: 'free', customer_name: undefined, people: undefined, arrival_time: undefined, notes: undefined };
    setUmbrellas(p => p.map(um => um.id === updated.id ? updated : um));
    alertedRef.current.delete(u.id);
    await pushUpdate(updated);
  }

  function loginBoss() {
    if (bossPass === BOSS_PASSWORD) { setIsBoss(true); setShowLogin(false); setShowPanel(true); setBossPass(''); }
    else alert('Λάθος κωδικός');
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const nFree     = umbrellas.filter(u => u.status === 'free').length;
  const nOccupied = umbrellas.filter(u => u.status === 'occupied').length;
  const nReserved = umbrellas.filter(u => u.status === 'reserved').length;
  const nPremOcc  = umbrellas.filter(u => u.premium && u.status === 'occupied').length;
  const longStays = umbrellas.filter(u => u.status === 'occupied' && u.arrival_time && minutesSince(u.arrival_time) >= ALERT_HOURS * 60);

  const columns = ROW_COUNTS.map((_, ri) => umbrellas.filter(u => u.row_num === ri + 1));

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🌊</div>
      <div style={{ color: C.gold, fontSize: 18, fontFamily: 'Georgia, serif' }}>Φόρτωση...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: C.cream, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg,${C.navy} 0%,${C.navyLight} 100%)`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ color: C.gold, fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: 1 }}>ACQUA Beach</div>
          <div style={{ color: C.textLight, fontSize: 10 }}>Διαχείριση Ομπρελών · {getNow()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {longStays.length > 0 && (
            <button onClick={() => { setIsBoss(true); setShowPanel(true); setPanelTab('timers'); }}
              style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', animation: 'pulse 1.5s infinite' }}>
              ⚠️ {longStays.length} πολλή ώρα
            </button>
          )}
          <div title={sync === 'ok' ? 'Συγχρονισμένο' : sync === 'busy' ? 'Αποθήκευση...' : 'Σφάλμα σύνδεσης'}
            style={{ width: 9, height: 9, borderRadius: '50%', background: sync === 'ok' ? '#2ecc71' : sync === 'busy' ? C.gold : '#e74c3c', boxShadow: sync === 'ok' ? '0 0 0 3px #2ecc7130' : 'none' }} />
          <button onClick={() => isBoss ? setShowPanel(true) : setShowLogin(true)}
            style={{ background: C.gold, color: C.navy, border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {isBoss ? '👔 Panel' : '🔐 Διαχείριση'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ background: C.navyLight, padding: '8px 0', display: 'flex', justifyContent: 'center', gap: 24 }}>
        {([['Ελεύθερες', nFree, '#2ecc71'], ['Κατειλημμένες', nOccupied, '#e74c3c'], ['Κρατημένες', nReserved, C.gold]] as const).map(([l, v, c]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ color: c, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{v}</div>
            <div style={{ color: C.textLight, fontSize: 10 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── Duration legend strip ── */}
      <div style={{ background: C.sand, padding: '6px 12px', display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>Διάρκεια:</span>
        {[['< 1ω', '#2ecc71'], ['1–2ω', '#f59e0b'], ['2–3ω', '#f97316'], ['3ω+', '#dc2626']].map(([l, c]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
            <span style={{ fontSize: 10, color: C.textMuted }}>{l}</span>
          </div>
        ))}
      </div>

      {/* ── Sea ── */}
      <div style={{ background: 'linear-gradient(180deg,#005bb5 0%,#0099dd 100%)', padding: '7px 0', textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: 3 }}>
        🌊 ΘΑΛΑΣΣΑ 🌊
      </div>

      {/* ── Grid ── */}
      <div style={{ padding: '14px 8px 8px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-start', minWidth: 'fit-content', margin: '0 auto' }}>
          {columns.slice(0, 4).map((col, ri) => (
            <div key={ri} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>Σ{ri + 1}</div>
              {col.map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onQuickRelease={quickRelease} now={now} />)}
            </div>
          ))}
          <div style={{ width: 2, alignSelf: 'stretch', background: `linear-gradient(to bottom,transparent,${C.gold},transparent)`, margin: '24px 4px' }} />
          {columns[4] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>⭐VIP</div>
              {columns[4].map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onQuickRelease={quickRelease} now={now} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Bar ── */}
      <div style={{ background: C.navy, padding: '7px 0', textAlign: 'center', color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3 }}>
        🍹 BAR · ΕΙΣΟΔΟΣ
      </div>

      {/* ── Legend ── */}
      <div style={{ padding: '8px 0', display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Object.entries(STATUS).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: v.color }} />
            <span style={{ fontSize: 11, color: C.textMuted }}>{v.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#e74c3c', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>×</div>
          <span style={{ fontSize: 11, color: C.textMuted }}>Γρήγορη αποδέσμευση</span>
        </div>
      </div>

      {/* ════════ MODALS ════════ */}

      {/* Umbrella Modal */}
      {selected && (() => {
        const selMins = selected.status === 'occupied' && selected.arrival_time ? minutesSince(selected.arrival_time) : 0;
        const selDur = selected.status === 'occupied' && selected.arrival_time ? durationColor(selMins) : null;
        return (
          <div onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ background: C.cream, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '6px 20px 36px', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)' }}>
              <div style={{ width: 40, height: 4, background: C.sandDark, borderRadius: 2, margin: '10px auto 14px' }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: selDur ? selDur.border : STATUS[modalStatus].color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{selected.number}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Ομπρέλα #{selected.number}{selected.premium ? ' ⭐' : ''}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    {selected.arrival_time ? `Άφιξη: ${selected.arrival_time}` : 'Νέα είσοδος'}
                  </div>
                </div>
                {/* Duration badge */}
                {selDur && (
                  <div style={{ background: selDur.border, color: '#fff', borderRadius: 10, padding: '6px 10px', textAlign: 'center', minWidth: 60 }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>⏱{formatDuration(selMins)}</div>
                    <div style={{ fontSize: 9 }}>{selDur.label}</div>
                  </div>
                )}
              </div>

              {/* Status buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(Object.keys(STATUS) as UmbrellaStatus[]).map(s => (
                  <button key={s} onClick={() => setModalStatus(s)} style={{
                    flex: 1, padding: '11px 4px', borderRadius: 12,
                    border: `2px solid ${modalStatus === s ? STATUS[s].color : STATUS[s].border}`,
                    background: modalStatus === s ? STATUS[s].color : STATUS[s].bg,
                    color: modalStatus === s ? '#fff' : STATUS[s].text,
                    fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s',
                  }}>{STATUS[s].label}</button>
                ))}
              </div>

              {modalStatus !== 'free' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input value={modalName} onChange={e => setModalName(e.target.value)}
                    placeholder="Όνομα πελάτη (προαιρετικό)"
                    style={{ padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, background: C.white, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                  <input value={modalPeople} onChange={e => setModalPeople(e.target.value)}
                    placeholder="Αριθμός ατόμων" type="number" min="1"
                    style={{ padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, background: C.white, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                  <input value={modalNotes} onChange={e => setModalNotes(e.target.value)}
                    placeholder="Σημειώσεις (προαιρετικό)"
                    style={{ padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, background: C.white, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => setSelected(null)} style={{ flex: 1, padding: '14px', borderRadius: 14, border: `1.5px solid ${C.sandDark}`, background: C.sand, color: C.textMuted, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Ακύρωση</button>
                <button onClick={saveModal} style={{ flex: 2, padding: '14px', borderRadius: 14, border: 'none', background: STATUS[modalStatus].color, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  {modalStatus === 'free' ? '✅ Αποδέσμευση' : '💾 Αποθήκευση'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Boss Login */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.cream, borderRadius: 18, padding: '28px 24px', width: '88%', maxWidth: 320 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 18, textAlign: 'center' }}>🔐 Διαχειριστής</div>
            <input type="password" value={bossPass} onChange={e => setBossPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loginBoss()} placeholder="Κωδικός" autoFocus
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowLogin(false); setBossPass(''); }} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: C.sand, color: C.textMuted, fontWeight: 600, cursor: 'pointer' }}>Άκυρο</button>
              <button onClick={loginBoss} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: C.navy, color: C.gold, fontWeight: 700, cursor: 'pointer' }}>Είσοδος</button>
            </div>
          </div>
        </div>
      )}

      {/* Boss Panel */}
      {showPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.cream, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '6px 20px 0', borderBottom: `1px solid ${C.sand}`, flexShrink: 0 }}>
              <div style={{ width: 40, height: 4, background: C.sandDark, borderRadius: 2, margin: '10px auto 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>
                  {isBoss ? '👔 Panel Διαχείρισης' : '⏱ Χρονόμετρα'}
                </div>
                <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto' }}>
                <button onClick={() => setPanelTab('timers')}
                  style={{ flex: 1, minWidth: 80, padding: '8px 4px', borderRadius: 10, border: 'none', background: panelTab === 'timers' ? '#dc2626' : C.sand, color: panelTab === 'timers' ? '#fff' : C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  ⏱ Χρόνοι {longStays.length > 0 && `(${longStays.length}⚠️)`}
                </button>
                {isBoss && <>
                  <button onClick={() => setPanelTab('stats')}
                    style={{ flex: 1, minWidth: 80, padding: '8px 4px', borderRadius: 10, border: 'none', background: panelTab === 'stats' ? C.navy : C.sand, color: panelTab === 'stats' ? C.gold : C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    📊 Στατιστικά
                  </button>
                  <button onClick={() => { setPanelTab('history'); fetchHistory(); }}
                    style={{ flex: 1, minWidth: 80, padding: '8px 4px', borderRadius: 10, border: 'none', background: panelTab === 'history' ? C.navy : C.sand, color: panelTab === 'history' ? C.gold : C.textMuted, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    📋 Ιστορικό
                  </button>
                </>}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 24px' }}>

              {/* ── Timers tab (available to all) ── */}
              {panelTab === 'timers' && (() => {
                const occupied = umbrellas
                  .filter(u => u.status === 'occupied' && u.arrival_time)
                  .map(u => ({ ...u, mins: minutesSince(u.arrival_time!) }))
                  .sort((a, b) => b.mins - a.mins); // longest first

                return occupied.length === 0
                  ? <div style={{ color: C.textMuted, fontSize: 14, textAlign: 'center', padding: '30px 0' }}>Δεν υπάρχουν κατειλημμένες ομπρέλες ☂️</div>
                  : <>
                    {longStays.length > 0 && (
                      <div style={{ background: '#fef2f2', border: '1.5px solid #dc2626', borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <div>
                          <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 13 }}>Πολλή ώρα! ({longStays.length} ομπρέλες)</div>
                          <div style={{ fontSize: 11, color: '#7f1d1d' }}>Πάνω από {ALERT_HOURS} ώρες — σκεφτείτε να τις ελέγξετε</div>
                        </div>
                      </div>
                    )}
                    {occupied.map(u => {
                      const dc = durationColor(u.mins);
                      return (
                        <div key={u.id} style={{ background: dc.bg, borderRadius: 12, padding: '11px 14px', marginBottom: 8, border: `1.5px solid ${dc.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: dc.border, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>{u.number}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: C.text, fontSize: 13 }}>{u.customer_name || 'Ανώνυμος'}{u.premium ? ' ⭐' : ''}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>
                              Άφιξη {u.arrival_time} · {u.people ? `${u.people} άτομα` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: dc.border }}>⏱{formatDuration(u.mins)}</div>
                            <div style={{ fontSize: 10, color: dc.text, fontWeight: 600 }}>{dc.label}</div>
                          </div>
                          <button onClick={() => quickRelease(u)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>Αποδ.</button>
                        </div>
                      );
                    })}
                  </>;
              })()}

              {/* ── Stats tab ── */}
              {panelTab === 'stats' && isBoss && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Ελεύθερες',     value: nFree,     color: '#2ecc71', icon: '☂️' },
                      { label: 'Κατειλημμένες', value: nOccupied, color: '#e74c3c', icon: '🏖️' },
                      { label: 'Κρατημένες',    value: nReserved,  color: C.gold,   icon: '📋' },
                      { label: 'VIP ενεργές',   value: nPremOcc,   color: C.teal,   icon: '⭐' },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.white, borderRadius: 14, padding: 14, textAlign: 'center', border: `1px solid ${C.sand}` }}>
                        <div style={{ fontSize: 24 }}>{s.icon}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontWeight: 600, color: C.navy, marginBottom: 8, fontSize: 13 }}>Ενεργές τώρα:</div>
                  {umbrellas.filter(u => u.status !== 'free').length === 0
                    ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Όλες ελεύθερες ☂️</div>
                    : umbrellas.filter(u => u.status !== 'free').map(u => (
                      <div key={u.id} style={{ background: C.white, borderRadius: 12, padding: '11px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${STATUS[u.status].border}` }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: STATUS[u.status].color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{u.number}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{u.customer_name || 'Ανώνυμος'}{u.premium ? ' ⭐' : ''}</div>
                            <div style={{ fontSize: 11, color: C.textMuted }}>
                              {u.arrival_time && `⏱ ${u.arrival_time}`}{u.people ? ` · ${u.people} άτ.` : ''}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => quickRelease(u)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Αποδ.</button>
                      </div>
                    ))
                  }
                </>
              )}

              {/* ── History tab ── */}
              {panelTab === 'history' && isBoss && (
                <>
                  <div style={{ fontWeight: 600, color: C.navy, marginBottom: 8, fontSize: 13 }}>Ιστορικό αποχωρήσεων:</div>
                  {history.length === 0
                    ? <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Δεν υπάρχει ιστορικό ακόμα</div>
                    : history.map(h => (
                      <div key={h.id} style={{ background: C.white, borderRadius: 12, padding: '11px 14px', marginBottom: 8, border: `1px solid ${C.sand}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontWeight: 600, color: C.navy, fontSize: 13 }}>Ομπρέλα #{h.umbrella_number}{h.premium ? ' ⭐' : ''}</span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{h.date}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {h.customer_name && <>{h.customer_name} · </>}
                          {h.people && <>{h.people} άτομα · </>}
                          {h.arrival_time && <>🕐 {h.arrival_time} → {h.departure_time}</>}
                        </div>
                        {h.notes && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>📝 {h.notes}</div>}
                      </div>
                    ))
                  }
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
