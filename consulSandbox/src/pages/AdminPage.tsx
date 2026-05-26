import { useState } from 'react';

interface AdminPageProps {
  llms: string[];
  commentArray: string[];
}

type StepKey = 'populate' | 'moderation' | 'extraction' | 'summary';
type StepStatus = 'idle' | 'loading' | 'done' | 'error';
type Steps = Record<StepKey, StepStatus>;

interface DbStats {
  deliberation_id: number;
  comments_fetched: number;
  moderation_done: boolean;
  extraction_done: boolean;
  summary_done: boolean;
  summary_preview: string;
}

const API_HEADER = { 'ai4d': '' };
const BACKEND = import.meta.env.VITE_BACKEND_URL || '/api';
const DELIBERATION_ID = 1798;

const CONTEXT_TEXT = `In den Jahren 2020/21 kam es regelmäßig in den Abend- und Nachtstunden zu empfindlichen Ruhestörungen und Verschmutzungen auf der Unteren Brücke, bedingt durch die Schließung der Gastronomie etc. während der Corona-Pandemie. Anfang dieses Jahres beschloss der Stadtrat die probeweise Einrichtung einer Freischankfläche auf der Unteren Brücke, um der problematischen Situation entgegen zu wirken. War dies aus Sicht der Bürgerinnen und Bürger erfolgreich und soll die Freischankfläche fortgeführt werden? Diese Umfrage soll zu einem Meinungsbild führen, auf deren Grundlage der Stadtrat voraussichtlich am 26. Oktober 2022 über diesen Modellversuch und das weitere Vorgehen berät.

Bitte teilen Sie Verwaltung und Stadtrat hier Ihre Meinung mit! Neben der Beurteilung, ob das ursprüngliche Ziel des Testlaufs erreicht wurde, haben Sie auch ausreichend Gelegenheit, andere Begleiterscheinungen der Freischankfläche zu bewerten. Bitte machen Sie davon gerne Gebrauch. Vielen Dank.`;

const stepColor = (s: StepStatus) =>
  ({ idle: '#94a3b8', loading: '#f59e0b', done: '#22c55e', error: '#ef4444' }[s]);

const stepIcon = (s: StepStatus) =>
  ({ idle: '○', loading: '⟳', done: '✓', error: '✗' }[s]);

const STEP_META: { key: StepKey; label: string; icon: string }[] = [
  { key: 'populate',   label: 'Populate DB', icon: '📥' },
  { key: 'moderation', label: 'Moderation',  icon: '🛡️' },
  { key: 'extraction', label: 'Extraction',  icon: '🔍' },
  { key: 'summary',    label: 'Summary',     icon: '📝' },
];

// ── Robust polling ─────────────────────────────────────────────────────────────
//
// Previous version crashed with "Unexpected token '<'" whenever the status
// endpoint returned an HTML error page (nginx 502/404) instead of JSON.
// Fix: parse the response as text first, then try JSON.parse; treat any
// non-200 or unparseable response as a transient hiccup and keep polling
// (up to a separate `maxConsecutiveErrors` guard before giving up).
//
async function pollUntilDone(
  url: string,
  intervalMs = 4000,
  timeoutMs  = 30 * 60 * 1000,
  maxConsecutiveErrors = 5,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, intervalMs));

    let status: string | null = null;

    try {
      const res  = await fetch(url, { headers: API_HEADER });
      const text = await res.text();          // always read as text first

      if (!res.ok) {
        // Non-200 HTTP → likely a transient proxy/server error; keep waiting
        console.warn(`[poll] HTTP ${res.status} from ${url} — retrying…`);
        consecutiveErrors++;
      } else {
        const json = JSON.parse(text);        // safe parse after text read
        status = json.status ?? null;
        consecutiveErrors = 0;               // reset on any valid JSON reply
      }
    } catch (err) {
      // Network error or JSON parse failure → transient; keep waiting
      console.warn(`[poll] fetch/parse error — retrying…`, err);
      consecutiveErrors++;
    }

    if (consecutiveErrors >= maxConsecutiveErrors) {
      throw new Error(
        `Polling aborted after ${maxConsecutiveErrors} consecutive errors. ` +
        `The background task may still be running — check the server logs.`
      );
    }

    if (status === 'done')  return;
    if (status === 'error') throw new Error('Task failed on server (status: error).');
    // status === 'running' | 'idle' | null → keep polling
  }

  throw new Error('Polling timed out — the task may still be running on the server.');
}

export default function AdminPage({ llms }: AdminPageProps) {

  const [steps, setSteps] = useState<Steps>({
    populate: 'idle', moderation: 'idle', extraction: 'idle', summary: 'idle',
  });
  const [dbStats,          setDbStats         ] = useState<DbStats | null>(null);
  const [dbLog,            setDbLog           ] = useState<string[]>([]);
  const [selectedLlm,      setSelectedLlm     ] = useState('gpt-oss:120b');
  const [summaryType,      setSummaryType     ] = useState('Report');
  const [modPipeline                          ] = useState('Detoxify -> llama_guard -> LLM');
  const [dbModerationTable, setDbModerationTable] = useState<any[]>([]);
  const [isTableLoading,   setIsTableLoading  ] = useState(false);

  const setStep = (key: StepKey, status: StepStatus) =>
    setSteps(prev => ({ ...prev, [key]: status }));

  const log = (msg: string) =>
    setDbLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const isAnyLoading = Object.values(steps).includes('loading');
  const isPopulated  = steps.populate === 'done';

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePopulate = async () => {
    setDbLog([]);
    setSteps({ populate: 'loading', moderation: 'idle', extraction: 'idle', summary: 'idle' });
    try {
      const res  = await fetch(`${BACKEND}/db/populate/${DELIBERATION_ID}`, { method: 'POST', headers: API_HEADER });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`);
      setDbStats({ deliberation_id: data.deliberation_id, comments_fetched: data.total, moderation_done: false, extraction_done: false, summary_done: false, summary_preview: '' });
      setStep('populate', 'done');
      log(`✓ ${data.total} comments saved.`);
    } catch (err: any) { setStep('populate', 'error'); log(`✗ Error: ${err.message}`); }
  };

  const handleDbModeration = async () => {
    setStep('moderation', 'loading');
    try {
      const form = new FormData();
      form.append('pipeline', modPipeline);
      const res = await fetch(`${BACKEND}/db/moderation/${DELIBERATION_ID}`, { method: 'POST', headers: API_HEADER, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status} — failed to start moderation`);
      log('⟳ Moderation started, polling for completion…');
      await pollUntilDone(`${BACKEND}/db/moderation/status/${DELIBERATION_ID}`);
      setDbStats(prev => prev ? { ...prev, moderation_done: true } : prev);
      setStep('moderation', 'done');
      log('✓ Moderation completed.');
    } catch (err: any) {
      setStep('moderation', 'error');
      log(`✗ Error: ${err.message}`);
    }
  };

  const handleDbExtraction = async () => {
    setStep('extraction', 'loading');
    try {
      const form = new FormData();
      form.append('llm', selectedLlm);
      const res = await fetch(`${BACKEND}/db/extraction/${DELIBERATION_ID}`, { method: 'POST', headers: API_HEADER, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status} — failed to start extraction`);
      log('⟳ Extraction started, polling for completion…');
      await pollUntilDone(`${BACKEND}/db/extraction/status/${DELIBERATION_ID}`);
      setDbStats(prev => prev ? { ...prev, extraction_done: true } : prev);
      setStep('extraction', 'done');
      log('✓ Position extraction completed.');
    } catch (err: any) {
      setStep('extraction', 'error');
      log(`✗ Error: ${err.message}`);
    }
  };

  const handleDbSummary = async () => {
    setStep('summary', 'loading');
    try {
      const form = new FormData();
      form.append('llm', selectedLlm);
      form.append('summary_type', summaryType);
      form.append('context_text', CONTEXT_TEXT);
      const res = await fetch(`${BACKEND}/db/summary/${DELIBERATION_ID}`, { method: 'POST', headers: API_HEADER, body: form });
      if (!res.ok) throw new Error(`HTTP ${res.status} — failed to start summary`);
      log('⟳ Summary started, polling for completion…');
      await pollUntilDone(`${BACKEND}/db/summary/status/${DELIBERATION_ID}`);
      const docRes = await fetch(`${BACKEND}/db/deliberation/${DELIBERATION_ID}`, { headers: API_HEADER });
      const doc    = await docRes.json();
      setDbStats(prev => prev ? { ...prev, summary_done: true, summary_preview: doc.summary ?? '' } : prev);
      setStep('summary', 'done');
      log('✓ Summary saved to database.');
    } catch (err: any) {
      setStep('summary', 'error');
      log(`✗ Error: ${err.message}`);
    }
  };

  const fetchModerationFromDb = async () => {
    setIsTableLoading(true);
    try {
      const res  = await fetch(`${BACKEND}/db/deliberation/${DELIBERATION_ID}`, { method: 'GET', headers: API_HEADER });
      const data = await res.json();
      if (data && data.comments) {
        setDbModerationTable(data.comments.filter((c: any) => c.moderation).map((c: any) => c.moderation));
      }
    } catch (err) {
      console.error("Failed to fetch moderation from DB", err);
    } finally {
      setIsTableLoading(false);
    }
  };

  // ── Render (unchanged) ────────────────────────────────────────────────────

  return (
    <div style={{
      fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
      background: '#f4f5f7',
      minHeight: '100vh',
      padding: '32px 40px',
      color: '#1a2332',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '36px', paddingBottom: '24px', borderBottom: '1px solid #dde1e7' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#1a3a5c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>🗄️</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#1a2332', letterSpacing: '-0.3px' }}>Database Administration</h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', marginTop: '2px' }}>Deliberation ID: {DELIBERATION_ID}</p>
        </div>
      </div>

      {/* Pipeline Card */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e6ec', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '28px 32px', marginBottom: '20px' }}>

        {/* Step tracker */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e8ecf0', borderRadius: '10px', padding: '18px 28px', marginBottom: '28px', gap: 0 }}>
          {STEP_META.map(({ key, label }, idx) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', flex: idx < 3 ? 1 : 'unset' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '90px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: stepColor(steps[key]), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', boxShadow: steps[key] === 'done' ? '0 0 0 4px rgba(45,106,79,0.15)' : 'none', transition: 'all 0.3s ease' }}>
                  <span style={steps[key] === 'loading' ? { animation: 'spin 1s linear infinite', display: 'inline-block' } : {}}>
                    {stepIcon(steps[key])}
                  </span>
                </div>
                <span style={{ fontSize: '11px', marginTop: '8px', color: '#475569', fontWeight: 500, letterSpacing: '0.2px' }}>{label}</span>
              </div>
              {idx < 3 && (
                <div style={{ flex: 1, height: '2px', background: steps[key] === 'done' ? '#2d6a4f' : '#dde1e7', marginBottom: '20px', transition: 'background 0.4s ease' }} />
              )}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: '📥 Populate DB',    handler: handlePopulate,      disabled: isAnyLoading },
            { label: '🛡️ Run Moderation', handler: handleDbModeration,  disabled: !isPopulated || isAnyLoading },
            { label: '🔍 Run Extraction', handler: handleDbExtraction,  disabled: !isPopulated || isAnyLoading },
            { label: '📝 Run Summary',    handler: handleDbSummary,     disabled: !isPopulated || isAnyLoading },
          ].map(({ label, handler, disabled }) => (
            <button
              key={label}
              onClick={handler}
              disabled={disabled}
              style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: disabled ? '#e8ecf0' : '#1a3a5c', color: disabled ? '#94a3b8' : '#fff', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.18s ease, transform 0.1s ease', letterSpacing: '0.1px' }}
              onMouseEnter={e => { if (!disabled) (e.target as HTMLButtonElement).style.background = '#122840'; }}
              onMouseLeave={e => { if (!disabled) (e.target as HTMLButtonElement).style.background = '#1a3a5c'; }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats strip */}
      {dbStats && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {[
            { label: 'Comments',   value: dbStats.comments_fetched,                    icon: '💬' },
            { label: 'Moderation', value: dbStats.moderation_done ? 'Done' : 'Pending', icon: '🛡️' },
            { label: 'Extraction', value: dbStats.extraction_done ? 'Done' : 'Pending', icon: '🔍' },
            { label: 'Summary',    value: dbStats.summary_done    ? 'Done' : 'Pending', icon: '📝' },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: '#fff', border: '1px solid #e2e6ec', borderRadius: '10px', padding: '14px 20px', flex: '1 1 140px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{icon} {label}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#1a2332' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Log */}
      {dbLog.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e6ec', borderRadius: '10px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>📋 Log</div>
          <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '12.5px', color: '#334155', lineHeight: '1.7' }}>
            {dbLog.map((line, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: i < dbLog.length - 1 ? '1px solid #f1f5f9' : 'none', color: line.includes('✗') ? '#c0392b' : line.includes('✓') ? '#2d6a4f' : '#334155' }}>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Moderation Results */}
      <div style={{ background: '#fff', border: '1px solid #e2e6ec', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 28px', borderBottom: '1px solid #e8ecf0', background: '#fafbfc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🛡️</span>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#1a2332' }}>Moderation Results</h2>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', borderRadius: '20px', padding: '2px 10px' }}>From Database</span>
          </div>
          <button
            onClick={fetchModerationFromDb}
            disabled={isTableLoading}
            style={{ padding: '9px 18px', borderRadius: '8px', border: '1.5px solid #1a3a5c', background: isTableLoading ? '#f1f5f9' : 'transparent', color: isTableLoading ? '#94a3b8' : '#1a3a5c', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: isTableLoading ? 'not-allowed' : 'pointer', transition: 'all 0.18s ease' }}
            onMouseEnter={e => { if (!isTableLoading) { (e.target as HTMLButtonElement).style.background = '#1a3a5c'; (e.target as HTMLButtonElement).style.color = '#fff'; } }}
            onMouseLeave={e => { if (!isTableLoading) { (e.target as HTMLButtonElement).style.background = 'transparent'; (e.target as HTMLButtonElement).style.color = '#1a3a5c'; } }}
          >
            {isTableLoading ? '⟳ Fetching...' : 'Show from Database'}
          </button>
        </div>

        {dbModerationTable.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Processed Text', 'Flagged', 'Justification'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e6ec' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dbModerationTable.map((res: any, idx: number) => (
                  <tr key={idx}
                    style={{ borderBottom: '1px solid #f1f5f9', background: res.is_it_flagged ? '#fef9f9' : '#f9fefb', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = res.is_it_flagged ? '#fdeaea' : '#f0faf4')}
                    onMouseLeave={e => (e.currentTarget.style.background = res.is_it_flagged ? '#fef9f9' : '#f9fefb')}
                  >
                    <td style={{ padding: '14px 20px', fontSize: '13.5px', color: '#334155', lineHeight: '1.55', maxWidth: '460px' }}>{res.moderated_text}</td>
                    <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: res.is_it_flagged ? '#fee2e2' : '#dcfce7', color: res.is_it_flagged ? '#c0392b' : '#2d6a4f' }}>
                        {res.is_it_flagged ? '⚠️ Yes' : '✓ No'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '12.5px', color: '#64748b', lineHeight: '1.5' }}>{res.explanation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '48px 32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>🛡️</div>
            Click «Show from Database» to load moderation results.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap');
      `}</style>
    </div>
  );
}