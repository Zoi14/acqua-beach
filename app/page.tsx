'use client';
import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://owomepqgtxrmkylzmjgp.supabase.co',
  'sb_publishable_9IwPnnK_8PDjPjo6QR76kg_dsxFXQqP'
);

type UmbrellaStatus = 'free' | 'occupied' | 'reserved';
interface WaitlistEntry { id: string; customer_name: string; people?: number; preference: string; notes?: string; added_at: string; date: string; }
interface HistoryEntry { id: string; umbrella_number: number; premium: boolean; customer_name?: string; people?: number; arrival_time?: string; departure_time: string; notes?: string; date: string; }
interface Umbrella { id: string; number: number; row_num: number; col_num: number; status: UmbrellaStatus; premium: boolean; people?: number; customer_name?: string; arrival_time?: string; notes?: string; }

const ROW_COUNTS = [8, 8, 8, 8, 5];
const BOSS_PASSWORD = 'boss123';
const ALERT_HOURS = 3;

const C = { navy: '#0d2b3e', navyLight: '#1a4a63', teal: '#1a6b7c', gold: '#c9a84c', goldLight: '#e4c46e', cream: '#f7f3ee', sand: '#e8ddd0', sandDark: '#d4c4b0', white: '#ffffff', text: '#1a2e3a', textMuted: '#5a7a8a', textLight: '#8fa8b5' };
const STATUS = {
  free:     { label: 'Ελεύθερη',     color: '#2ecc71', bg: '#eafaf1', border: '#a9dfbf', text: '#1a7a40' },
  occupied: { label: 'Κατειλημμένη', color: '#e74c3c', bg: '#fdf0ef', border: '#f1948a', text: '#922b21' },
  reserved: { label: 'Κρατημένη',    color: C.gold,    bg: '#fdf8ec', border: C.goldLight, text: '#7d6025' },
};

function getNow() { return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' }); }
function getToday() { return new Date().toLocaleDateString('el-GR'); }
function minutesSince(t: string): number {
  const [h, m] = t.split(':').map(Number);
  const now = new Date(), then = new Date();
  then.setHours(h, m, 0, 0);
  const d = (now.getTime() - then.getTime()) / 60000;
  return d < 0 ? d + 1440 : d;
}
function fmt(mins: number) { if (mins < 60) return `${Math.floor(mins)}λ`; const h = Math.floor(mins / 60), m = Math.floor(mins % 60); return m ? `${h}ω${m}λ` : `${h}ω`; }
function durColor(mins: number) {
  if (mins < 60)  return { bg: '#eafaf1', border: '#2ecc71', text: '#1a7a40', label: 'Νωρίς' };
  if (mins < 120) return { bg: '#fefce8', border: '#f59e0b', text: '#92400e', label: 'Μεσαία' };
  if (mins < 180) return { bg: '#fff7ed', border: '#f97316', text: '#7c2d12', label: 'Αρκετή' };
  return              { bg: '#fef2f2', border: '#dc2626', text: '#7f1d1d', label: 'Πολλή!' };
}
function genUmbrellas(): Umbrella[] {
  const out: Umbrella[] = []; let n = 1;
  ROW_COUNTS.forEach((cnt, ri) => { const row = ri + 1, last = row === ROW_COUNTS.length; for (let c = 1; c <= cnt; c++) out.push({ id: `${row}-${c}`, number: n++, row_num: row, col_num: c, status: 'free', premium: last || c === 1 }); });
  return out;
}

function UmbrellaCell({ u, onTap, onRelease, assignMode, now: _now }: { u: Umbrella; onTap: (u: Umbrella) => void; onRelease: (u: Umbrella) => void; assignMode: boolean; now: Date; }) {
  const [hov, setHov] = useState(false);
  const busy = u.status !== 'free';
  const mins = u.status === 'occupied' && u.arrival_time ? minutesSince(u.arrival_time) : 0;
  const dc = u.status === 'occupied' && u.arrival_time ? durColor(mins) : null;
  const long = mins >= ALERT_HOURS * 60;
  const bc = hov ? (dc ? dc.border : STATUS[u.status].color) : (dc ? dc.border : STATUS[u.status].border);
  const dimmed = assignMode && u.status !== 'free';

  return (
    <div style={{ position: 'relative', opacity: dimmed ? 0.35 : 1 }}>
      <button onClick={() => onTap(u)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ width: 62, height: 72, borderRadius: 14, border: `2px solid ${bc}`, background: hov ? bc + '28' : (dc ? dc.bg : STATUS[u.status].bg), cursor: dimmed ? 'not-allowed' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3px 2px', gap: 1, transition: 'all 0.15s', boxShadow: long ? '0 0 0 3px #dc262640' : hov ? `0 4px 14px ${bc}44` : '0 1px 4px rgba(0,0,0,0.08)', position: 'relative' }}>
        {u.premium && <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: C.gold }}>⭐</span>}
        {long && <span style={{ position: 'absolute', top: 2, left: 4, width: 7, height: 7, borderRadius: '50%', background: '#dc2626', display: 'block', animation: 'pulse 1.5s infinite' }} />}
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: dc ? dc.border : STATUS[u.status].color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.number}</div>
        <div style={{ fontSize: 14 }}>{u.status === 'occupied' ? '🏖️' : u.status === 'reserved' ? '📋' : '☂️'}</div>
        {u.status === 'occupied' && u.arrival_time && <div style={{ fontSize: 8, color: dc!.text, fontWeight: 700, textAlign: 'center' }}>⏱{fmt(mins)}</div>}
        {u.status === 'reserved' && u.arrival_time && <div style={{ fontSize: 8, color: STATUS.reserved.text, fontWeight: 600 }}>{u.arrival_time}</div>}
        {u.people && busy && <div style={{ fontSize: 7, color: C.textMuted, fontWeight: 600 }}>{u.people}👤</div>}
      </button>
      {busy && !assignMode && (
        <button onClick={e => { e.stopPropagation(); onRelease(u); }}
          style={{ position: 'absolute', top: -7, left: -7, width: 20, height: 20, borderRadius: '50%', background: '#e74c3c', color: '#fff', border: '2px solid #fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 5 }}>×</button>
      )}
      {assignMode && u.status === 'free' && (
        <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: '#2ecc71', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 6, padding: '2px 5px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>TAP</div>
      )}
    </div>
  );
}

export default function BeachPage() {
  const [umbrellas, setUmbrellas] = useState<Umbrella[]>([]);
  const [history, setHistory]     = useState<HistoryEntry[]>([]);
  const [waitlist, setWaitlist]   = useState<WaitlistEntry[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sync, setSync]           = useState<'ok'|'busy'|'err'>('ok');
  const [now, setNow]             = useState(new Date());

  const [selected, setSelected]       = useState<Umbrella | null>(null);
  const [modalStatus, setModalStatus] = useState<UmbrellaStatus>('free');
  const [modalName, setModalName]     = useState('');
  const [modalPeople, setModalPeople] = useState('');
  const [modalNotes, setModalNotes]   = useState('');

  const [isBoss, setIsBoss]       = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [bossPass, setBossPass]   = useState('');
  const [panelTab, setPanelTab]   = useState<'timers'|'waitlist'|'stats'|'history'>('timers');

  const [showAddWait, setShowAddWait] = useState(false);
  const [waitName, setWaitName]       = useState('');
  const [waitPeople, setWaitPeople]   = useState('');
  const [waitPref, setWaitPref]       = useState('any');
  const [waitNotes, setWaitNotes]     = useState('');
  const [assignWait, setAssignWait]   = useState<WaitlistEntry | null>(null);

  const alertedRef   = useRef<Set<string>>(new Set());
  const prevRef      = useRef<Umbrella[]>([]);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);

  // Notify on new occupation
  useEffect(() => {
    if (prevRef.current.length > 0) {
      umbrellas.forEach(u => {
        const p = prevRef.current.find(x => x.id === u.id);
        if (p && p.status !== 'occupied' && u.status === 'occupied') {
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`🏖️ Ομπρέλα #${u.number} — Νέος πελάτης!`, { body: `${u.customer_name || 'Ανώνυμος'}${u.people ? ` · ${u.people} άτομα` : ''} · ${u.arrival_time}` });
          }
        }
      });
    }
    prevRef.current = umbrellas;
  }, [umbrellas]);

  // Long-stay alerts
  useEffect(() => {
    umbrellas.forEach(u => {
      if (u.status === 'occupied' && u.arrival_time) {
        const m = minutesSince(u.arrival_time);
        if (m >= ALERT_HOURS * 60 && !alertedRef.current.has(u.id)) {
          alertedRef.current.add(u.id);
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted')
            new Notification(`⚠️ Ομπρέλα #${u.number} — ${fmt(m)}!`, { body: `${u.customer_name || 'Ανώνυμος'} · Άφιξη ${u.arrival_time}` });
        }
      } else { alertedRef.current.delete(u.id); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, umbrellas]);

  async function fetchUmbrellas() {
    const { data, error } = await supabase.from('umbrellas').select('*').order('number');
    if (error) { setSync('err'); setLoading(false); return; }
    if (!data || data.length === 0) { const init = genUmbrellas(); await supabase.from('umbrellas').insert(init); setUmbrellas(init); }
    else setUmbrellas(data as Umbrella[]);
    setLoading(false);
  }
  async function fetchHistory() {
    const { data } = await supabase.from('history').select('*').order('created_at', { ascending: false }).limit(500);
    if (data) setHistory(data as HistoryEntry[]);
  }
  async function fetchWaitlist() {
    const { data } = await supabase.from('waitlist').select('*').order('created_at').eq('date', getToday());
    if (data) setWaitlist(data as WaitlistEntry[]);
  }
  async function pushUpdate(u: Umbrella) {
    setSync('busy');
    const { error } = await supabase.from('umbrellas').update(u).eq('id', u.id);
    setSync(error ? 'err' : 'ok');
  }
  async function pushHistory(u: Umbrella) {
    if (!u.arrival_time) return;
    const e: HistoryEntry = { id: `${Date.now()}`, umbrella_number: u.number, premium: u.premium, customer_name: u.customer_name, people: u.people, arrival_time: u.arrival_time, departure_time: getNow(), notes: u.notes, date: getToday() };
    await supabase.from('history').insert(e);
    setHistory(p => [e, ...p].slice(0, 500));
  }
  async function addToWaitlist() {
    if (!waitName.trim()) return;
    const e: WaitlistEntry = { id: `w-${Date.now()}`, customer_name: waitName.trim(), people: parseInt(waitPeople) || undefined, preference: waitPref, notes: waitNotes || undefined, added_at: getNow(), date: getToday() };
    await supabase.from('waitlist').insert(e);
    setWaitlist(p => [...p, e]);
    setWaitName(''); setWaitPeople(''); setWaitPref('any'); setWaitNotes('');
    setShowAddWait(false);
  }
  async function removeWait(id: string) {
    await supabase.from('waitlist').delete().eq('id', id);
    setWaitlist(p => p.filter(w => w.id !== id));
  }

  useEffect(() => {
    fetchUmbrellas(); fetchHistory(); fetchWaitlist();
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    const ch = supabase.channel('beach-v3')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'umbrellas' }, p => setUmbrellas(prev => prev.map(u => u.id === p.new.id ? p.new as Umbrella : u)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'umbrellas' }, p => setUmbrellas(prev => [...prev, p.new as Umbrella].sort((a, b) => a.number - b.number)))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waitlist' }, p => setWaitlist(prev => [...prev, p.new as WaitlistEntry]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'waitlist' }, p => setWaitlist(prev => prev.filter(w => w.id !== (p.old as WaitlistEntry).id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openModal(u: Umbrella) {
    if (assignWait && u.status !== 'free') return;
    setSelected(u);
    setModalStatus(assignWait ? 'occupied' : u.status);
    setModalName(assignWait ? assignWait.customer_name : (u.customer_name || ''));
    setModalPeople(assignWait ? (assignWait.people?.toString() || '') : (u.people?.toString() || ''));
    setModalNotes(assignWait ? (assignWait.notes || '') : (u.notes || ''));
  }

  async function saveModal() {
    if (!selected) return;
    if (selected.status !== 'free' && modalStatus === 'free') await pushHistory(selected);
    const updated: Umbrella = { ...selected, status: modalStatus, customer_name: modalStatus === 'free' ? undefined : (modalName || undefined), people: modalStatus === 'free' ? undefined : (parseInt(modalPeople) || undefined), arrival_time: modalStatus === 'free' ? undefined : (selected.arrival_time || getNow()), notes: modalStatus === 'free' ? undefined : (modalNotes || undefined) };
    setUmbrellas(p => p.map(u => u.id === updated.id ? updated : u));
    if (assignWait && modalStatus === 'occupied') { await removeWait(assignWait.id); setAssignWait(null); }
    setSelected(null);
    await pushUpdate(updated);
  }

  async function quickRelease(u: Umbrella) {
    await pushHistory(u);
    const updated: Umbrella = { ...u, status: 'free', customer_name: undefined, people: undefined, arrival_time: undefined, notes: undefined };
    setUmbrellas(p => p.map(x => x.id === updated.id ? updated : x));
    alertedRef.current.delete(u.id);
    await pushUpdate(updated);
  }

  function loginBoss() {
    if (bossPass === BOSS_PASSWORD) { setIsBoss(true); setShowLogin(false); setShowPanel(true); setBossPass(''); }
    else alert('Λάθος κωδικός');
  }

  const today = getToday();
  const todayHistory = history.filter(h => h.date === today);
  const totalToday = todayHistory.length + umbrellas.filter(u => u.status === 'occupied').length;
  const nFree = umbrellas.filter(u => u.status === 'free').length;
  const nOcc  = umbrellas.filter(u => u.status === 'occupied').length;
  const nRes  = umbrellas.filter(u => u.status === 'reserved').length;
  const longStays = umbrellas.filter(u => u.status === 'occupied' && u.arrival_time && minutesSince(u.arrival_time) >= ALERT_HOURS * 60);
  const columns = ROW_COUNTS.map((_, ri) => umbrellas.filter(u => u.row_num === ri + 1));

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 44 }}>🌊</div>
      <div style={{ color: C.gold, fontSize: 18, fontFamily: 'Georgia, serif' }}>Φόρτωση...</div>
    </div>
  );

  const inp = { padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, background: C.white, color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box' as const };

  return (
    <div style={{ minHeight: '100dvh', background: C.cream, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}} @keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* Assign banner */}
      {assignWait && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 400, background: '#16a34a', color: '#fff', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>🎯 Επιλέξτε ελεύθερη ομπρέλα για: {assignWait.customer_name}</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{assignWait.people ? `${assignWait.people} άτομα` : ''}{assignWait.preference !== 'any' ? ` · ${assignWait.preference === 'premium' ? '⭐ Premium' : '🌊 Θάλασσα'}` : ''}</div>
          </div>
          <button onClick={() => setAssignWait(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>✕ Άκυρο</button>
        </div>
      )}

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg,${C.navy} 0%,#1a3d5c 60%,${C.navyLight} 100%)`, position: 'sticky', top: assignWait ? 52 : 0, zIndex: 100, boxShadow: '0 2px 20px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: C.gold, fontSize: 22, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: 3 }}>ACQUA</div>
            <div style={{ color: C.textLight, fontSize: 9, letterSpacing: 2 }}>BEACH BAR · {getNow()}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {longStays.length > 0 && <button onClick={() => { setShowPanel(true); setPanelTab('timers'); }} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', animation: 'pulse 1.5s infinite' }}>⚠️{longStays.length}</button>}
            {waitlist.length > 0 && <button onClick={() => { setShowPanel(true); setPanelTab('waitlist'); }} style={{ background: C.gold, color: C.navy, border: 'none', borderRadius: 8, padding: '5px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⏳{waitlist.length}</button>}
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: sync === 'ok' ? '#2ecc71' : sync === 'busy' ? C.gold : '#e74c3c', boxShadow: sync === 'ok' ? '0 0 0 3px #2ecc7130' : 'none' }} />
            <button onClick={() => isBoss ? setShowPanel(true) : setShowLogin(true)} style={{ background: `linear-gradient(135deg,${C.gold},${C.goldLight})`, color: C.navy, border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(201,168,76,0.35)' }}>{isBoss ? '👔' : '🔐'}</button>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {[['Ελεύθερες', nFree, '#2ecc71'], ['Κατειλημμένες', nOcc, '#e74c3c'], ['Κρατημένες', nRes, C.gold], ['Σήμερα', totalToday, C.teal]].map(([l, v, c]) => (
            <div key={l as string} style={{ flex: 1, textAlign: 'center', padding: '7px 2px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: c as string, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{v as number}</div>
              <div style={{ color: C.textLight, fontSize: 9 }}>{l as string}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Duration strip */}
      <div style={{ background: C.sand, padding: '5px 0', display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', borderBottom: `1px solid ${C.sandDark}` }}>
        <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700 }}>ΔΙΑΡΚΕΙΑ:</span>
        {[['<1ω','#2ecc71'],['1-2ω','#f59e0b'],['2-3ω','#f97316'],['3ω+','#dc2626']].map(([l,c])=>(
          <div key={l} style={{ display:'flex',alignItems:'center',gap:3 }}>
            <div style={{ width:9,height:9,borderRadius:3,background:c }} />
            <span style={{ fontSize:9,color:C.textMuted }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Sea */}
      <div style={{ background: 'linear-gradient(180deg,#003d8a,#0077cc)', padding: '8px 0', textAlign: 'center', color: '#fff', fontSize: 12, fontWeight: 600, letterSpacing: 3 }}>🌊 ΘΑΛΑΣΣΑ 🌊</div>

      {/* Grid */}
      <div style={{ padding: '14px 8px 8px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-start', minWidth: 'fit-content', margin: '0 auto' }}>
          {columns.slice(0, 4).map((col, ri) => (
            <div key={ri} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ color: C.textMuted, fontSize: 9, fontWeight: 700, background: C.sand, borderRadius: 6, padding: '2px 7px' }}>Σ{ri+1}</div>
              {col.map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onRelease={quickRelease} assignMode={!!assignWait} now={now} />)}
            </div>
          ))}
          <div style={{ width: 2, alignSelf: 'stretch', background: `linear-gradient(to bottom,transparent,${C.gold},transparent)`, margin: '24px 4px' }} />
          {columns[4] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ color: C.gold, fontSize: 9, fontWeight: 700, background: '#fdf8ec', borderRadius: 6, padding: '2px 7px', border: `1px solid ${C.goldLight}` }}>⭐VIP</div>
              {columns[4].map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onRelease={quickRelease} assignMode={!!assignWait} now={now} />)}
            </div>
          )}
        </div>
      </div>

      {/* Bar */}
      <div style={{ background: `linear-gradient(135deg,${C.navy},${C.navyLight})`, padding: '8px 0', textAlign: 'center', color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3 }}>🍹 BAR · ΕΙΣΟΔΟΣ</div>

      {/* Bottom actions */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button onClick={() => setShowAddWait(true)} style={{ flex: 1, background: C.navy, color: C.gold, border: 'none', borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 16px rgba(13,43,62,0.25)' }}>
          ⏳ Αναμονή {waitlist.length > 0 ? `(${waitlist.length})` : ''}
        </button>
        <button onClick={() => { setShowPanel(true); setPanelTab('timers'); }} style={{ flex: 1, background: C.sand, color: C.textMuted, border: `1px solid ${C.sandDark}`, borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>⏱ Χρόνοι</button>
        {isBoss && <button onClick={() => { setShowPanel(true); setPanelTab('stats'); }} style={{ flex: 1, background: C.sand, color: C.textMuted, border: `1px solid ${C.sandDark}`, borderRadius: 12, padding: '12px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📊 Stats</button>}
      </div>

      {/* Waitlist preview strip */}
      {waitlist.length > 0 && (
        <div style={{ margin: '0 12px 12px', background: '#fdf8ec', borderRadius: 14, border: `1.5px solid ${C.goldLight}`, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: C.gold, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: C.navy, fontWeight: 700, fontSize: 13 }}>⏳ Λίστα Αναμονής ({waitlist.length})</span>
          </div>
          {waitlist.map((w, i) => (
            <div key={w.id} style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < waitlist.length - 1 ? `1px solid ${C.sand}` : 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: C.gold, color: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{i+1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: C.text, fontSize: 13 }}>{w.customer_name}</div>
                <div style={{ fontSize: 10, color: C.textMuted }}>{w.people ? `${w.people} άτ. · ` : ''}{w.added_at}{w.preference !== 'any' ? ` · ${w.preference === 'premium' ? '⭐' : '🌊'}` : ''}</div>
              </div>
              <button onClick={() => { setAssignWait(w); }} style={{ background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Ανάθεση</button>
              <button onClick={() => removeWait(w.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8, padding: '6px 8px', fontSize: 13, cursor: 'pointer' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div style={{ padding: '4px 0 16px', display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Object.entries(STATUS).map(([k,v]) => (
          <div key={k} style={{ display:'flex',alignItems:'center',gap:4 }}>
            <div style={{ width:9,height:9,borderRadius:'50%',background:v.color }} />
            <span style={{ fontSize:10,color:C.textMuted }}>{v.label}</span>
          </div>
        ))}
        <div style={{ display:'flex',alignItems:'center',gap:4 }}>
          <div style={{ width:16,height:16,borderRadius:'50%',background:'#e74c3c',color:'#fff',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700 }}>×</div>
          <span style={{ fontSize:10,color:C.textMuted }}>Γρήγορη αποδέσμευση</span>
        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Add to waitlist */}
      {showAddWait && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowAddWait(false); }} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,padding:'6px 20px 36px',animation:'slideUp 0.3s ease' }}>
            <div style={{ width:40,height:4,background:C.sandDark,borderRadius:2,margin:'10px auto 16px' }} />
            <div style={{ fontWeight:700,fontSize:16,color:C.navy,marginBottom:16 }}>⏳ Προσθήκη σε Αναμονή</div>
            <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              <input value={waitName} onChange={e=>setWaitName(e.target.value)} placeholder="Όνομα πελάτη *" style={inp} />
              <input value={waitPeople} onChange={e=>setWaitPeople(e.target.value)} placeholder="Αριθμός ατόμων" type="number" min="1" style={inp} />
              <div style={{ display:'flex',gap:8 }}>
                {[['any','Οποιαδήποτε'],['premium','⭐ Premium'],['sea','🌊 Θάλασσα']].map(([v,l])=>(
                  <button key={v} onClick={()=>setWaitPref(v)} style={{ flex:1,padding:'10px 4px',borderRadius:10,border:`2px solid ${waitPref===v?C.gold:C.sandDark}`,background:waitPref===v?'#fdf8ec':C.white,color:waitPref===v?C.text:C.textMuted,fontWeight:waitPref===v?700:400,fontSize:11,cursor:'pointer' }}>{l}</button>
                ))}
              </div>
              <input value={waitNotes} onChange={e=>setWaitNotes(e.target.value)} placeholder="Σημειώσεις (προαιρετικό)" style={inp} />
            </div>
            <div style={{ display:'flex',gap:10,marginTop:14 }}>
              <button onClick={()=>setShowAddWait(false)} style={{ flex:1,padding:'14px',borderRadius:14,border:`1.5px solid ${C.sandDark}`,background:C.sand,color:C.textMuted,fontWeight:600,fontSize:15,cursor:'pointer' }}>Ακύρωση</button>
              <button onClick={addToWaitlist} style={{ flex:2,padding:'14px',borderRadius:14,border:'none',background:C.navy,color:C.gold,fontWeight:700,fontSize:15,cursor:'pointer' }}>✅ Προσθήκη</button>
            </div>
          </div>
        </div>
      )}

      {/* Umbrella modal */}
      {selected && (()=>{
        const sm = selected.status==='occupied'&&selected.arrival_time?minutesSince(selected.arrival_time):0;
        const sd = selected.status==='occupied'&&selected.arrival_time?durColor(sm):null;
        return (
          <div onClick={e=>{if(e.target===e.currentTarget){setSelected(null);setAssignWait(null);}}} style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200 }}>
            <div style={{ background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:480,padding:'6px 20px 36px',animation:'slideUp 0.3s ease' }}>
              <div style={{ width:40,height:4,background:C.sandDark,borderRadius:2,margin:'10px auto 14px' }} />
              {assignWait && <div style={{ background:'#eafaf1',border:'1px solid #a9dfbf',borderRadius:10,padding:'8px 12px',marginBottom:12,fontSize:12,color:'#1a7a40',fontWeight:600 }}>🎯 Ανάθεση ομπρέλας #{selected.number} → {assignWait.customer_name}</div>}
              <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:14 }}>
                <div style={{ width:42,height:42,borderRadius:'50%',background:sd?sd.border:STATUS[modalStatus].color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:700 }}>{selected.number}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700,color:C.text,fontSize:15 }}>Ομπρέλα #{selected.number}{selected.premium?' ⭐':''}</div>
                  <div style={{ fontSize:11,color:C.textMuted }}>{selected.arrival_time?`Άφιξη: ${selected.arrival_time}`:'Νέα είσοδος'}</div>
                </div>
                {sd && <div style={{ background:sd.border,color:'#fff',borderRadius:10,padding:'6px 10px',textAlign:'center' }}><div style={{ fontSize:15,fontWeight:700 }}>⏱{fmt(sm)}</div><div style={{ fontSize:9 }}>{sd.label}</div></div>}
              </div>
              <div style={{ display:'flex',gap:8,marginBottom:14 }}>
                {(Object.keys(STATUS) as UmbrellaStatus[]).map(s=>(
                  <button key={s} onClick={()=>setModalStatus(s)} style={{ flex:1,padding:'11px 4px',borderRadius:12,border:`2px solid ${modalStatus===s?STATUS[s].color:STATUS[s].border}`,background:modalStatus===s?STATUS[s].color:STATUS[s].bg,color:modalStatus===s?'#fff':STATUS[s].text,fontWeight:700,fontSize:11,cursor:'pointer',transition:'all 0.15s' }}>{STATUS[s].label}</button>
                ))}
              </div>
              {modalStatus!=='free' && (
                <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                  <input value={modalName} onChange={e=>setModalName(e.target.value)} placeholder="Όνομα πελάτη" style={inp} />
                  <input value={modalPeople} onChange={e=>setModalPeople(e.target.value)} placeholder="Αριθμός ατόμων" type="number" min="1" style={inp} />
                  <input value={modalNotes} onChange={e=>setModalNotes(e.target.value)} placeholder="Σημειώσεις" style={inp} />
                </div>
              )}
              <div style={{ display:'flex',gap:10,marginTop:14 }}>
                <button onClick={()=>{setSelected(null);setAssignWait(null);}} style={{ flex:1,padding:'14px',borderRadius:14,border:`1.5px solid ${C.sandDark}`,background:C.sand,color:C.textMuted,fontWeight:600,fontSize:15,cursor:'pointer' }}>Ακύρωση</button>
                <button onClick={saveModal} style={{ flex:2,padding:'14px',borderRadius:14,border:'none',background:STATUS[modalStatus].color,color:'#fff',fontWeight:700,fontSize:15,cursor:'pointer' }}>{modalStatus==='free'?'✅ Αποδέσμευση':assignWait?'🎯 Ανάθεση':'💾 Αποθήκευση'}</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Login */}
      {showLogin && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:C.cream,borderRadius:20,padding:'28px 24px',width:'88%',maxWidth:320,animation:'fadeIn 0.2s ease',boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>
            <div style={{ textAlign:'center',marginBottom:20 }}><div style={{ fontSize:36 }}>🔐</div><div style={{ fontWeight:700,fontSize:17,color:C.navy,marginTop:8 }}>Διαχειριστής</div></div>
            <input type="password" value={bossPass} onChange={e=>setBossPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loginBoss()} placeholder="Κωδικός" autoFocus style={{ ...inp, textAlign:'center', marginBottom:14 }} />
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={()=>{setShowLogin(false);setBossPass('');}} style={{ flex:1,padding:'13px',borderRadius:12,border:'none',background:C.sand,color:C.textMuted,fontWeight:600,cursor:'pointer' }}>Άκυρο</button>
              <button onClick={loginBoss} style={{ flex:1,padding:'13px',borderRadius:12,border:'none',background:C.navy,color:C.gold,fontWeight:700,cursor:'pointer' }}>Είσοδος</button>
            </div>
          </div>
        </div>
      )}

      {/* Panel */}
      {showPanel && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',display:'flex',alignItems:'flex-end',justifyContent:'center',zIndex:200 }}>
          <div style={{ background:C.cream,borderRadius:'20px 20px 0 0',width:'100%',maxWidth:600,maxHeight:'90vh',display:'flex',flexDirection:'column',animation:'slideUp 0.3s ease',boxShadow:'0 -8px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ padding:'6px 20px 0',borderBottom:`1px solid ${C.sand}`,flexShrink:0 }}>
              <div style={{ width:40,height:4,background:C.sandDark,borderRadius:2,margin:'10px auto 12px' }} />
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
                <div style={{ fontWeight:700,fontSize:16,color:C.navy }}>ACQUA Beach · Panel</div>
                <button onClick={()=>setShowPanel(false)} style={{ background:C.sand,border:'none',borderRadius:8,width:32,height:32,fontSize:18,cursor:'pointer',color:C.textMuted,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
              </div>
              <div style={{ display:'flex',gap:6,marginBottom:12 }}>
                {([['timers',`⏱${longStays.length>0?` ⚠️${longStays.length}`:''}`],['waitlist',`⏳${waitlist.length>0?` ${waitlist.length}`:''}`],...(isBoss?[['stats','📊'],['history','📋']]:[])]) as [string,string][]).map(([t,l])=>(
                  <button key={t} onClick={()=>{setPanelTab(t as typeof panelTab);if(t==='history')fetchHistory();}} style={{ flex:1,padding:'8px 4px',borderRadius:10,border:'none',background:panelTab===t?C.navy:C.sand,color:panelTab===t?C.gold:C.textMuted,fontWeight:700,fontSize:12,cursor:'pointer' }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ flex:1,overflowY:'auto',padding:'14px 20px 24px' }}>

              {panelTab==='timers' && (()=>{
                const occ = umbrellas.filter(u=>u.status==='occupied'&&u.arrival_time).map(u=>({...u,mins:minutesSince(u.arrival_time!)})).sort((a,b)=>b.mins-a.mins);
                return occ.length===0
                  ? <div style={{ textAlign:'center',color:C.textMuted,padding:'30px 0' }}>Δεν υπάρχουν κατειλημμένες ☂️</div>
                  : <>{longStays.length>0&&<div style={{ background:'#fef2f2',border:'1.5px solid #dc2626',borderRadius:12,padding:'10px 14px',marginBottom:14 }}><span style={{ fontSize:18 }}>⚠️</span> <span style={{ fontWeight:700,color:'#dc2626',fontSize:13 }}>{longStays.length} ομπρέλες πάνω από {ALERT_HOURS} ώρες!</span></div>}
                  {occ.map(u=>{const dc=durColor(u.mins);return(
                    <div key={u.id} style={{ background:dc.bg,borderRadius:12,padding:'11px 14px',marginBottom:8,border:`1.5px solid ${dc.border}`,display:'flex',alignItems:'center',gap:10 }}>
                      <div style={{ width:34,height:34,borderRadius:'50%',background:dc.border,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700,flexShrink:0 }}>{u.number}</div>
                      <div style={{ flex:1 }}><div style={{ fontWeight:700,color:C.text,fontSize:13 }}>{u.customer_name||'Ανώνυμος'}{u.premium?' ⭐':''}</div><div style={{ fontSize:11,color:C.textMuted }}>{u.arrival_time}{u.people?` · ${u.people} άτ.`:''}</div></div>
                      <div style={{ fontSize:17,fontWeight:700,color:dc.border }}>⏱{fmt(u.mins)}</div>
                      <button onClick={()=>quickRelease(u)} style={{ background:'#e74c3c',color:'#fff',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer' }}>Αποδ.</button>
                    </div>
                  );})}
                </>;
              })()}

              {panelTab==='waitlist' && (
                <div>
                  <button onClick={()=>{setShowPanel(false);setShowAddWait(true);}} style={{ width:'100%',padding:'12px',borderRadius:12,border:`2px dashed ${C.sandDark}`,background:'transparent',color:C.textMuted,fontWeight:600,fontSize:14,cursor:'pointer',marginBottom:14 }}>+ Νέος σε αναμονή</button>
                  {waitlist.length===0
                    ? <div style={{ textAlign:'center',color:C.textMuted,padding:'20px 0' }}>Κανείς σε αναμονή</div>
                    : waitlist.map((w,i)=>(
                      <div key={w.id} style={{ background:C.white,borderRadius:12,padding:'12px 14px',marginBottom:8,border:`1px solid ${C.sand}`,display:'flex',alignItems:'center',gap:10 }}>
                        <div style={{ width:28,height:28,borderRadius:'50%',background:C.gold,color:C.navy,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,flexShrink:0 }}>{i+1}</div>
                        <div style={{ flex:1 }}><div style={{ fontWeight:600,color:C.text,fontSize:13 }}>{w.customer_name}</div><div style={{ fontSize:11,color:C.textMuted }}>{w.people?`${w.people} άτ. · `:''}{w.added_at}{w.preference!=='any'?` · ${w.preference==='premium'?'⭐':'🌊'}`:''}</div>{w.notes&&<div style={{ fontSize:11,color:C.textMuted }}>📝 {w.notes}</div>}</div>
                        <button onClick={()=>{setAssignWait(w);setShowPanel(false);}} style={{ background:'#2ecc71',color:'#fff',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer',marginRight:4 }}>Ανάθεση</button>
                        <button onClick={()=>removeWait(w.id)} style={{ background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:8,padding:'6px 8px',fontSize:13,cursor:'pointer' }}>×</button>
                      </div>
                    ))
                  }
                </div>
              )}

              {panelTab==='stats'&&isBoss&&(
                <>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10,marginBottom:16 }}>
                    {[{l:'Σύνολο σήμερα',v:totalToday,c:C.teal,i:'👥'},{l:'Τώρα',v:nOcc,c:'#e74c3c',i:'🏖️'},{l:'Ελεύθερες',v:nFree,c:'#2ecc71',i:'☂️'},{l:'Κρατημένες',v:nRes,c:C.gold,i:'📋'}].map(s=>(
                      <div key={s.l} style={{ background:C.white,borderRadius:14,padding:14,textAlign:'center',border:`1px solid ${C.sand}` }}><div style={{ fontSize:26 }}>{s.i}</div><div style={{ fontSize:30,fontWeight:700,color:s.c }}>{s.v}</div><div style={{ fontSize:11,color:C.textMuted }}>{s.l}</div></div>
                    ))}
                  </div>
                  {umbrellas.filter(u=>u.status!=='free').map(u=>(
                    <div key={u.id} style={{ background:C.white,borderRadius:12,padding:'11px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',border:`1px solid ${STATUS[u.status].border}` }}>
                      <div style={{ display:'flex',gap:10,alignItems:'center' }}>
                        <div style={{ width:30,height:30,borderRadius:'50%',background:STATUS[u.status].color,color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700 }}>{u.number}</div>
                        <div><div style={{ fontSize:13,fontWeight:600 }}>{u.customer_name||'Ανώνυμος'}{u.premium?' ⭐':''}</div><div style={{ fontSize:11,color:C.textMuted }}>{u.arrival_time&&`⏱ ${u.arrival_time}`}{u.people?` · ${u.people} άτ.`:''}</div></div>
                      </div>
                      <button onClick={()=>quickRelease(u)} style={{ background:'#e74c3c',color:'#fff',border:'none',borderRadius:8,padding:'6px 10px',fontSize:12,fontWeight:700,cursor:'pointer' }}>Αποδ.</button>
                    </div>
                  ))}
                </>
              )}

              {panelTab==='history'&&isBoss&&(
                <>
                  <div style={{ background:C.navyLight,borderRadius:12,padding:'12px 16px',marginBottom:14,display:'flex',justifyContent:'space-between' }}>
                    <div style={{ color:C.textLight,fontSize:12 }}>Σήμερα ({today})</div>
                    <div style={{ color:C.gold,fontWeight:700 }}>{todayHistory.length} αποχωρήσεις · {totalToday} σύνολο</div>
                  </div>
                  {history.length===0
                    ? <div style={{ color:C.textMuted,fontSize:13,textAlign:'center',padding:'20px 0' }}>Δεν υπάρχει ιστορικό</div>
                    : history.map(h=>(
                      <div key={h.id} style={{ background:h.date===today?C.white:'#f8f8f8',borderRadius:12,padding:'11px 14px',marginBottom:8,border:`1px solid ${h.date===today?C.sand:C.sandDark}` }}>
                        <div style={{ display:'flex',justifyContent:'space-between',marginBottom:3 }}><span style={{ fontWeight:600,color:C.navy,fontSize:13 }}>Ομπρέλα #{h.umbrella_number}{h.premium?' ⭐':''}</span><span style={{ fontSize:11,color:C.textMuted }}>{h.date}</span></div>
                        <div style={{ fontSize:12,color:C.textMuted }}>{h.customer_name&&<>{h.customer_name} · </>}{h.people&&<>{h.people} άτομα · </>}{h.arrival_time&&<>🕐 {h.arrival_time} → {h.departure_time}</>}</div>
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
