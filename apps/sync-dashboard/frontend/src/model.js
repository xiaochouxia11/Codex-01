export function statusOf(run) {
  return run.status === 'completed' ? (run.conclusion || 'unknown') : run.status;
}

export function filterRuns(runs, query, status) {
  return runs.filter(run => run.name.toLowerCase().includes(query.toLowerCase()) &&
    (status === 'all' || statusOf(run) === status));
}

export function summarize(runs) {
  return { workflows: new Set(runs.map(run => run.name)).size,
    successful: runs.filter(run => statusOf(run) === 'success').length,
    failed: runs.filter(run => statusOf(run) === 'failure').length };
}
