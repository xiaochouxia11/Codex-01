import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { filterRuns, statusOf, summarize } from './model.js';
import './style.css';

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Unable to load records.');
  return data;
}

function timestamp(value) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

function Summary({ runs, mode }) {
  const totals = summarize(runs);
  return <section className="summary" aria-label="Run summary">
    {[[totals.workflows, 'Workflows'], [totals.successful, 'Successful runs'],
      [totals.failed, 'Failed runs']].map(([count, label]) =>
        <div className="metric" key={label}><strong>{count}</strong><span>{label}</span>
          <small>{mode === 'demo' ? 'Demo data' : 'Last 30 runs'}</small></div>)}
  </section>;
}

function RunTable({ runs }) {
  return <div className="table-scroll"><table><thead><tr>
    {['Workflow', 'Status', 'Branch', 'Updated (Shanghai)', 'Details'].map(label => <th key={label}>{label}</th>)}
  </tr></thead><tbody>{runs.map(run => <tr key={run.id}>
    <td className="workflow-name">{run.name}</td>
    <td><span className={`status ${statusOf(run)}`}><i aria-hidden="true"/>{statusOf(run).replaceAll('_', ' ')}</span></td>
    <td><code>{run.branch}</code></td>
    <td><time dateTime={run.updated_at}>{timestamp(run.updated_at)}</time></td>
    <td>{run.url ? <a href={run.url} target="_blank" rel="noreferrer">View run ↗</a> : <span className="muted">Demo only</span>}</td>
  </tr>)}</tbody></table>{runs.length === 0 && <p className="empty">No matching runs. Adjust your filters or refresh GitHub.</p>}</div>;
}

function App() {
  const [data, setData] = useState({ mode: 'demo', runs: [], cached_at: null });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/api/runs?mode=demo').then(setData).catch(err => setError(err.message))
      .finally(() => setBusy(false));
  }, []);

  async function load(kind) {
    setBusy(true); setError('');
    try {
      const result = kind === 'refresh'
        ? await request('/api/refresh', { method: 'POST' })
        : await request(`/api/runs?mode=${kind}`);
      setData(result);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return <><header><div className="brand">Codex Sync</div><span className="repository">xiaochouxia11 / Codex-01</span>
    <div className="actions"><button disabled={busy} onClick={() => load(data.mode === 'demo' ? 'live' : 'demo')}>
      {data.mode === 'demo' ? 'View cached live' : 'Demo data'}</button>
    <button className="primary" disabled={busy} onClick={() => load('refresh')}>{busy ? 'Loading…' : 'Refresh GitHub'}</button></div>
  </header><main><h1>Repository overview</h1><p className="subtitle">Read-only workflow monitoring.</p>
    <Summary runs={data.runs} mode={data.mode}/>
    <section aria-labelledby="runs-title"><div className="toolbar"><h2 id="runs-title">Workflow runs</h2><div className="filters">
      <label><span className="sr-only">Search workflows</span><input type="search" placeholder="Search workflows" value={query} onChange={event => setQuery(event.target.value)}/></label>
      <label><span className="sr-only">Status filter</span><select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="all">All statuses</option>{['success', 'failure', 'in_progress', 'queued', 'cancelled', 'skipped'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
      </select></label></div></div>
      {error && <p role="alert" className="error">{error} Previously loaded records are retained.</p>}
      <RunTable runs={filterRuns(data.runs, query, status)}/>
    </section>
    <p className="storage" role="status">{data.mode === 'demo' ? 'Demo data · Example records, not live results' : 'GitHub data · Latest 30 runs'} · Stored locally in SQLite
      {data.cached_at && <span> · Cached {timestamp(data.cached_at)} (Shanghai)</span>}</p>
    <p className="footnote">This dashboard never triggers a workflow or changes your repository.</p>
  </main></>;
}

createRoot(document.getElementById('root')).render(<App/>);
