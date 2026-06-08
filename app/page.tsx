'use client';
import { useState, useEffect } from 'react';
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

function generateInitialUmbrellas(): Umbrella[] {
  const out: Umbrella[] = [];
  let n = 1;
  ROW_COUNTS.forEach((count, ri) => {
    const row = ri + 1;
    const lastRow = row === ROW_COUNTS.length;
    for (let c = 1; c <= count; c++) {
      out.push({
        id: `${row}-${c}`, number: n++, row_num: row, col_num: c,
        status: 'free', premium: lastRow || c === 1,
      });
    }
  });
  return out;
}

function getNow() {
  return new Date().toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
}
function getToday() {
  return new Date().toLocaleDateString('el-GR');
}

// ── Umbrella Cell ──────────────────────────────────────────────────────────────
function UmbrellaCell({ u, onTap, onQuickRelease }: {
  u: Umbrella;
  onTap: (u: Umbrella) => void;
  onQuickRelease: (u: Umbrella) => void;
}) {
  const [hov, setHov] = useState(false);
  const s = STATUS[u.status];
  const busy = u.status !== 'free';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => onTap(u)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: 62, height: 70, borderRadius: 14,
          border: `2px solid ${hov ? s.color : s.border}`,
          background: hov ? s.color + '28' : s.bg,
          cursor: 'pointer', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '4px 2px', gap: 2, transition: 'all 0.15s',
          boxShadow: hov ? `0 4px 14px ${s.color}44` : '0 1px 4px rgba(0,0,0,0.08)',
          position: 'relative',
        }}
      >
        {u.premium && (
          <span style={{ position: 'absolute', top: 2, right: 4, fontSize: 9, color: C.gold }}>⭐</span>
        )}
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: s.color, color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{u.number}</div>
        <div style={{ fontSize: 16 }}>
          {u.status === 'occupied' ? '🏖️' : u.status === 'reserved' ? '📋' : '☂️'}
        </div>
        {busy && u.arrival_time && (
          <div style={{ fontSize: 8, color: s.text, fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>
            {u.arrival_time}{u.people ? `·${u.people}👤` : ''}
          </div>
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
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
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

  const [selected, setSelected]       = useState<Umbrella | null>(null);
  const [modalStatus, setModalStatus] = useState<UmbrellaStatus>('free');
  const [modalName, setModalName]     = useState('');
  const [modalPeople, setModalPeople] = useState('');
  const [modalNotes, setModalNotes]   = useState('');

  const [isBoss, setIsBoss]     = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [bossPass, setBossPass]   = useState('');
  const [panelTab, setPanelTab]   = useState<'stats'|'history'>('stats');

  // ── Supabase helpers ─────────────────────────────────────────────────────────
  async function fetchUmbrellas() {
    const { data, error } = await supabase
      .from('umbrellas').select('*').order('number');
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
    const { data } = await supabase
      .from('history').select('*')
      .order('created_at', { ascending: false }).limit(200);
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
      id: `${Date.now()}`,
      umbrella_number: u.number, premium: u.premium,
      customer_name: u.customer_name, people: u.people,
      arrival_time: u.arrival_time, departure_time: getNow(),
      notes: u.notes, date: getToday(),
    };
    await supabase.from('history').insert(entry);
    setHistory(p => [entry, ...p].slice(0, 200));
  }

  // ── Real-time subscription ───────────────────────────────────────────────────
  useEffect(() => {
    fetchUmbrellas();
    fetchHistory();

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

  // ── Modal helpers ────────────────────────────────────────────────────────────
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
      ...selected,
      status: modalStatus,
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
    await pushUpdate(updated);
  }

  function loginBoss() {
    if (bossPass === BOSS_PASSWORD) {
      setIsBoss(true); setShowLogin(false); setShowPanel(true); setBossPass('');
    } else {
      alert('Λάθος κωδικός');
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const nFree     = umbrellas.filter(u => u.status === 'free').length;
  const nOccupied = umbrellas.filter(u => u.status === 'occupied').length;
  const nReserved = umbrellas.filter(u => u.status === 'reserved').length;
  const nPremOcc  = umbrellas.filter(u => u.premium && u.status === 'occupied').length;

  const columns = ROW_COUNTS.map((_, ri) =>
    umbrellas.filter(u => u.row_num === ri + 1)
  );

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: C.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <div style={{ fontSize: 40 }}>🌊</div>
      <div style={{ color: C.gold, fontSize: 18, fontFamily: 'Georgia, serif' }}>Φόρτωση...</div>
      <div style={{ color: C.textLight, fontSize: 12 }}>Σύνδεση με βάση δεδομένων...</div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: C.cream, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.navyLight} 100%)`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ color: C.gold, fontSize: 20, fontWeight: 700, fontFamily: 'Georgia, serif', letterSpacing: 1 }}>ACQUA Beach</div>
          <div style={{ color: C.textLight, fontSize: 10 }}>Διαχείριση Ομπρελών</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div
            title={sync === 'ok' ? 'Συγχρονισμένο' : sync === 'busy' ? 'Αποθήκευση...' : 'Σφάλμα σύνδεσης'}
            style={{ width: 9, height: 9, borderRadius: '50%', background: sync === 'ok' ? '#2ecc71' : sync === 'busy' ? C.gold : '#e74c3c', boxShadow: sync === 'ok' ? '0 0 0 3px #2ecc7130' : 'none' }}
          />
          <button onClick={() => isBoss ? setShowPanel(true) : setShowLogin(true)}
            style={{ background: C.gold, color: C.navy, border: 'none', borderRadius: 8, padding: '7px 13px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {isBoss ? '👔 Panel' : '🔐 Διαχείριση'}
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div style={{ background: C.navyLight, padding: '8px 0', display: 'flex', justifyContent: 'center', gap: 28 }}>
        {([['Ελεύθερες', nFree, '#2ecc71'], ['Κατειλημμένες', nOccupied, '#e74c3c'], ['Κρατημένες', nReserved, C.gold]] as const).map(([l, v, c]) => (
          <div key={l} style={{ textAlign: 'center' }}>
            <div style={{ color: c, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{v}</div>
            <div style={{ color: C.textLight, fontSize: 10 }}>{l}</div>
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
              {col.map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onQuickRelease={quickRelease} />)}
            </div>
          ))}

          <div style={{ width: 2, alignSelf: 'stretch', background: `linear-gradient(to bottom, transparent, ${C.gold}, transparent)`, margin: '24px 4px' }} />

          {columns[4] && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>⭐VIP</div>
              {columns[4].map(u => <UmbrellaCell key={u.id} u={u} onTap={openModal} onQuickRelease={quickRelease} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Bar ── */}
      <div style={{ background: C.navy, padding: '7px 0', textAlign: 'center', color: C.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3 }}>
        🍹 BAR · ΕΙΣΟΔΟΣ
      </div>

      {/* ── Legend ── */}
      <div style={{ padding: '10px 0', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
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
      {selected && (
        <div onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.cream, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '6px 20px 36px', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ width: 40, height: 4, background: C.sandDark, borderRadius: 2, margin: '10px auto 14px' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: STATUS[modalStatus].color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700 }}>{selected.number}</div>
              <div>
                <div style={{ fontWeight: 700, color: C.text, fontSize: 15 }}>Ομπρέλα #{selected.number}</div>
                <div style={{ fontSize: 11, color: C.textMuted }}>{selected.premium ? '⭐ Premium · ' : ''}{selected.arrival_time ? `Άφιξη: ${selected.arrival_time}` : 'Νέα είσοδος'}</div>
              </div>
            </div>

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
      )}

      {/* Boss Login */}
      {showLogin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.cream, borderRadius: 18, padding: '28px 24px', width: '88%', maxWidth: 320 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: C.navy, marginBottom: 18, textAlign: 'center' }}>🔐 Διαχειριστής</div>
            <input type="password" value={bossPass} onChange={e => setBossPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loginBoss()}
              placeholder="Κωδικός" autoFocus
              style={{ width: '100%', padding: '13px', borderRadius: 12, border: `1.5px solid ${C.sandDark}`, fontSize: 15, marginBottom: 14, boxSizing: 'border-box', outline: 'none' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowLogin(false); setBossPass(''); }} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: C.sand, color: C.textMuted, fontWeight: 600, cursor: 'pointer' }}>Άκυρο</button>
              <button onClick={loginBoss} style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: C.navy, color: C.gold, fontWeight: 700, cursor: 'pointer' }}>Είσοδος</button>
            </div>
          </div>
        </div>
      )}

      {/* Boss Panel */}
      {showPanel && isBoss && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: C.cream, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 32px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '6px 20px 0', borderBottom: `1px solid ${C.sand}` }}>
              <div style={{ width: 40, height: 4, background: C.sandDark, borderRadius: 2, margin: '10px auto 12px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>👔 Panel Διαχείρισης</div>
                <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.textMuted, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['stats', 'history'] as const).map(t => (
                  <button key={t} onClick={() => { setPanelTab(t); if (t === 'history') fetchHistory(); }}
                    style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: panelTab === t ? C.navy : C.sand, color: panelTab === t ? C.gold : C.textMuted, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {t === 'stats' ? '📊 Στατιστικά' : '📋 Ιστορικό'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 24px' }}>
              {panelTab === 'stats' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Ελεύθερες',     value: nFree,     color: '#2ecc71', icon: '☂️' },
                      { label: 'Κατειλημμένες', value: nOccupied, color: '#e74c3c', icon: '🏖️' },
                      { label: 'Κρατημένες',    value: nReserved,  color: C.gold,   icon: '📋' },
                      { label: 'VIP ενεργές',   value: nPremOcc,   color: C.teal,   icon: '⭐' },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.white, borderRadius: 14, padding: '14px', textAlign: 'center', border: `1px solid ${C.sand}` }}>
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
                              {u.arrival_time ? `⏱ ${u.arrival_time}` : ''}
                              {u.people ? ` · ${u.people} άτ.` : ''}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => quickRelease(u)} style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Αποδ.</button>
                      </div>
                    ))
                  }
                </>
              )}

              {panelTab === 'history' && (
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
