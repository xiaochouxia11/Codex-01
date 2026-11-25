// Run with existing Playwright + Chromium and the installed visualize host CSS:
// Hover checks load the sibling visualize.html and its declared script dependencies.
// VISUALIZE_HOST_CSS=/path/to/visualize.css PLAYWRIGHT_MODULE=/path/to/playwright \
//   node tests/progress-view.cjs
// Optional SCREENSHOT_DIR saves dummy fixtures. Import { fixtures, render } for previews.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asset = fs.readFileSync(path.join(__dirname, '../skills/workflow/assets/migration-progress-view.html'), 'utf8');
const burndownAsset = fs.readFileSync(path.join(__dirname, '../skills/workflow/assets/transform-burndown.html'), 'utf8');
const burndownSlot = '<!-- TRANSFORM_BURNDOWN -->';
const steps = ['Initialize', 'Preflight', 'Assess', 'Behaviors', 'Brief', 'Transform', 'Verify target'];
const exampleUrl = part => `https://example.com/linear/${part}`;
const baseline = {
  MIGRATION_ID: 'linear:example-workspace:dummy-migration', MIGRATION_NAME: 'Dummy data · Todo migration',
  MIGRATION_HOME_URL: exampleUrl('migration'), MIGRATION_HOME_VISIBLE: true,
  MIGRATION_HOME_LABEL: 'Open Linear migration',
  CURRENT_SCOPE: '', SCOPE_VISIBLE: false,
  FRESHNESS: 'Checked 10:30 UTC', FRESHNESS_WARNING: '', FRESHNESS_WARNING_VISIBLE: false,
  DECISIONS_BLOCKERS: '', DECISIONS_BLOCKERS_VISIBLE: false,
  METRICS: [], ROWS: [], BURNDOWN_POINTS: [],
  ISSUES_VISIBLE: true, ISSUES_SUMMARY: 'Active issues · 2',
  ISSUES: [],
  RESOURCES_VISIBLE: true, RESOURCES_SUMMARY: 'Recent resources · 1',
  RESOURCES: [],
};
function metric(label, now, total) {
  return {
    STATE: 'is-active', LABEL: label, VALUE: total === undefined ? now : `${now} / ${total}`,
    NOW: total > 0 ? now : '', MAX: total > 0 ? total : '',
    PERCENT: total ? 100 * now / total : '', BAR_VISIBLE: total > 0,
    URL: exampleUrl(`metric/${encodeURIComponent(label)}`), LINK_VISIBLE: true,
  };
}
const issueTitles = [
  ['Define intent', 'Prepare tooling'], ['Detect stack', 'Check build'],
  ['Assess architecture', 'Assess code quality'], ['Identify source behaviors', 'Check UI behavior evidence'],
  ['Prepare migration brief', 'Target guidance'],
  ['Migrate API', 'Migrate UI'], ['Verify API behavior', 'Verify UI behavior'],
];
const resourceTitles = ['Migration intent', 'Preflight summary', 'Migration assessment', 'Behaviors',
  'Migration brief', 'Transformation report', 'Target verification report'];
function stage(index, metrics = [], rows = []) {
  return {
    ...baseline, CURRENT_STEP: `Step ${index} · ${steps[index]}`,
    ISSUES: issueTitles[index].map((title, n) => ({
      LABEL: `DEMO-${900 + index * 2 + n} — ${title}`,
      URL: exampleUrl(`issue/DEMO-${900 + index * 2 + n}?view=compact&source=fixture`),
      USER_REQUIRED: false,
    })),
    RESOURCES: [{ LABEL: resourceTitles[index], URL: exampleUrl('report'),
      RECENCY: 'Updated 8 Oct 2026, 10:30 UTC' }],
    ...Object.fromEntries(steps.flatMap((label, n) => [
      [`STEP_${n}_STATE`, n < index ? 'is-done' : n === index ? 'is-active' : 'is-pending'],
      [`STEP_${n}_LABEL`, `${label}: ${n < index ? 'completed' : n === index ? 'current' : 'pending'}`],
      [`STEP_${n}_CURRENT`, n === index ? 'step' : 'false'],
    ])),
    METRICS: metrics, ROWS: rows,
  };
}
function row(label, value, state = 'is-active') {
  return { STATE: state, LABEL: label, VALUE: value };
}
const fixtures = {
  initialize: stage(0, [metric('Intent approval', 'Awaiting user'), metric('Setup tasks', 1, 2)]),
  preflight: stage(1, [metric('Checks run', 6, 8), metric('Checks passed', 5, 8)],
    [row('Failed / unrun', '1 / 2')]),
  assess: stage(2, [metric('Investigations', 3, 4), metric('Synthesis', 'Pending')],
    [row('Hotspots', '3 modules')]),
  behaviors: stage(3, [metric('Reviewed behaviors', 22, 24), metric('Catalog approval', 'Awaiting user')]),
  brief: stage(4, [metric('Brief approval', 'Awaiting user')]),
  transform: stage(5, [metric('Accepted slices', 4, 7), metric('Dev tests passed', 18, 20)],
    [row('Phase verification', 'Pending', 'is-pending'), row('Open repairs', '2', 'is-blocked')]),
  target: stage(6, [metric('Behaviors verified', 23, 24), metric('Checks passed', 18, 20)],
    [row('Failed tests', '1', 'is-blocked'), row('Unverified behaviors', '1', 'is-pending')]),
};
// The adapter has normalized these sample issues' explicit human-action markers.
// Review status or failed checks alone do not set the flag.
for (const name of ['initialize', 'behaviors', 'brief']) Object.assign(fixtures[name], {
  ISSUES: fixtures[name].ISSUES.map((issue, index) => ({ ...issue, USER_REQUIRED: index === 0 })),
  ISSUES_SUMMARY: 'Active issues · 2 · 🚩 1',
});
Object.assign(fixtures.target, {
  RESOURCES_SUMMARY: 'Recent resources · 3',
  RESOURCES: [...fixtures.target.RESOURCES,
    { LABEL: 'Behaviors', URL: exampleUrl('document/behaviors'), RECENCY: 'Updated 8 Oct 2026, 10:15 UTC' },
    { LABEL: 'Migration assessment', URL: exampleUrl('document/assessment'), RECENCY: 'Created 8 Oct 2026, 09:00 UTC' }],
});
fixtures.complete = {
  ...fixtures.target, ISSUES_VISIBLE: false, ISSUES: [],
  STEP_6_STATE: 'is-done', STEP_6_LABEL: 'Verify target: completed',
  METRICS: [metric('Checks passed', 20, 20), metric('Behaviors verified', 24, 24)],
  ROWS: [],
};
fixtures.phaseverification = {
  ...fixtures.transform, CURRENT_SCOPE: 'Phase 2 · API', SCOPE_VISIBLE: true,
  RESOURCES_SUMMARY: 'Recent resources · 2 (recency unknown)',
  RESOURCES: [...fixtures.transform.RESOURCES,
    { LABEL: 'Migration brief', URL: exampleUrl('document/brief'), RECENCY: 'Update time unavailable' }],
  METRICS: [metric('Accepted slices', 7, 7), metric('Phase checks passed', 15, 20)],
  ROWS: [row('Open repairs', '2', 'is-blocked')],
};
fixtures.manyissues = {
  ...fixtures.transform, ISSUES_SUMMARY: 'Active issues · 8 · 🚩 2',
  ISSUES: [
    ...fixtures.transform.ISSUES.map(issue => ({ ...issue, USER_REQUIRED: true })),
    ...['Migrate persistence', 'Migrate search', 'Migrate notifications', 'Migrate permissions', 'Migrate exports', 'Migrate audit logs'].map((title, n) => ({
      LABEL: `DEMO-${916 + n} — ${title}`, URL: exampleUrl(`issue/DEMO-${916 + n}`), USER_REQUIRED: false,
    })),
  ],
  RESOURCES_SUMMARY: 'Recent resources · 8',
  RESOURCES: [...fixtures.transform.RESOURCES,
    { LABEL: 'Migration brief', URL: exampleUrl('document/brief'), RECENCY: 'Updated 8 Oct 2026, 10:15 UTC' },
    { LABEL: 'Target-stack guidance', URL: exampleUrl('document/target-guidance'), RECENCY: 'Created 8 Oct 2026, 09:00 UTC' },
    { LABEL: 'Phase 1 target verification', URL: exampleUrl('document/phase-1-target-verification'), RECENCY: 'Updated 7 Oct 2026, 17:00 UTC' },
    { LABEL: 'Behaviors', URL: exampleUrl('document/behaviors'), RECENCY: 'Updated 7 Oct 2026, 16:00 UTC' },
    { LABEL: 'Migration assessment', URL: exampleUrl('document/assessment'), RECENCY: 'Updated 7 Oct 2026, 15:00 UTC' },
    { LABEL: 'Migration intent', URL: exampleUrl('document/intent'), RECENCY: 'Updated 7 Oct 2026, 14:00 UTC' },
    { LABEL: 'Execution environment', URL: exampleUrl('document/environment'), RECENCY: 'Created 7 Oct 2026, 13:00 UTC' }],
};
fixtures.single = {
  ...fixtures.brief, ISSUES_SUMMARY: 'Active issues · 1 · 🚩 1',
  ISSUES: fixtures.brief.ISSUES.slice(0, 1),
};
fixtures.longlists = {
  ...fixtures.transform, ISSUES_SUMMARY: 'Active issues · 20 · 🚩 5',
  ISSUES: Array.from({ length: 20 }, (_, n) => ({ LABEL: `DEMO-${1000 + n} — Migrate module ${n + 1}`,
    URL: exampleUrl(`issue/DEMO-${1000 + n}`), USER_REQUIRED: n < 5 })),
  RESOURCES_SUMMARY: 'Recent resources · 12',
  RESOURCES: Array.from({ length: 12 }, (_, n) => ({ LABEL: `Phase ${12 - n} verification report`,
    URL: exampleUrl(`document/phase-${12 - n}`), RECENCY: `Updated ${12 - n} Sep 2026, 10:30 UTC` })),
};
fixtures.emptyrecords = {
  ...fixtures.complete, ISSUES: [], ISSUES_VISIBLE: false, RESOURCES: [], RESOURCES_VISIBLE: false,
};
fixtures.stress = {
  ...fixtures.transform, MIGRATION_NAME: 'Dummy data: Todo <migration> & "compatibility"',
  RESOURCES_SUMMARY: 'Recent resources · 2 (recency unknown)',
  FRESHNESS: 'Checked 10:30 UTC · source 7205464ce6012345678901234567890123456789012',
  ISSUES: [
    { LABEL: 'DEMO-912 — Independently verify authorization <script>window.injected = true</script> & "quoted" persistence',
      URL: exampleUrl('issue/DEMO-912?scope=ui&view=all'), USER_REQUIRED: true },
    { LABEL: 'DEMO-913 — Verify codex/codemod/todo-app-sveltekit-compatibility-7205464ce6012345678901234567890123456789012',
      URL: exampleUrl('issue/DEMO-913'), USER_REQUIRED: false }],
  ISSUES_SUMMARY: 'Active issues · 2 · 🚩 1',
  RESOURCES: [
    { LABEL: 'Todo <app> migration & "independent" verification report', URL: exampleUrl('document/report'),
      RECENCY: 'Updated 8 Oct 2026, 10:30 UTC & "checked"' },
    { LABEL: 'Full-stack transformation report for codex/codemod/todo-app-sveltekit-compatibility-7205464ce6012345678901234567890123456789012',
      URL: exampleUrl('document/long-title'), RECENCY: 'Update time unavailable' }],
  METRICS: [{ ...fixtures.transform.METRICS[0], LABEL: 'Slices <script>window.injected = true</script> & "quoted"' },
    { ...fixtures.transform.METRICS[1], LINK_VISIBLE: false, URL: '' }],
  ROWS: [row('Independent verification', 'Awaiting independent acceptance'),
    row('Checks', '15 passed · 2 failed · 3 unrun · 2 skipped'),
    row('Branch', 'codex/codemod/todo-app-sveltekit-compatibility'),
    row('Evidence <script>window.injected = true</script>', '<script>window.injected = true</script> & "quoted"')],
  DECISIONS_BLOCKERS: '<script>window.injected = true</script> & "quoted" evidence', DECISIONS_BLOCKERS_VISIBLE: true,
};
fixtures.unknown = {
  ...fixtures.preflight,
  METRICS: [{ ...metric('Evidence', 'Unavailable'), LINK_VISIBLE: false, URL: '' }], ROWS: [],
  STEP_0_STATE: 'is-pending', STEP_0_LABEL: 'Initialize: acceptance unknown',
  MIGRATION_HOME_VISIBLE: false, MIGRATION_HOME_URL: '', ISSUES_VISIBLE: false, ISSUES_SUMMARY: 'Active issues unavailable',
  ISSUES: [], RESOURCES: [],
  RESOURCES_VISIBLE: false, RESOURCES_SUMMARY: 'Resources unavailable',
  FRESHNESS: 'Last checked: unknown', FRESHNESS_WARNING: '', FRESHNESS_WARNING_VISIBLE: false,
};
fixtures.stale = {
  ...fixtures.target,
  METRICS: fixtures.target.METRICS.map(item => ({ ...item, VALUE: 'Unknown', NOW: '', MAX: '', PERCENT: '',
    BAR_VISIBLE: false, LINK_VISIBLE: false, URL: '' })), ROWS: [],
  FRESHNESS_WARNING: 'Stale · target candidate changed', FRESHNESS_WARNING_VISIBLE: true,
  DECISIONS_BLOCKERS: 'Refresh affected checks.', DECISIONS_BLOCKERS_VISIBLE: true,
};
fixtures.zero = {
  ...fixtures.target,
  METRICS: [metric('Checks passed', 0, 0), metric('Behaviors verified', 0, 0)], ROWS: [],
  DECISIONS_BLOCKERS: 'No scoped checks yet.', DECISIONS_BLOCKERS_VISIBLE: true,
};
// A status-only insight needs no metric entries.
fixtures.statusonly = {
  ...fixtures.brief, METRICS: [], ROWS: [row('Brief approval', 'Awaiting user')],
};
fixtures.emptyinsights = {
  ...fixtures.brief, METRICS: [], ROWS: [],
  DECISIONS_BLOCKERS: 'Load this stage’s evidence.', DECISIONS_BLOCKERS_VISIBLE: true,
};
// Capacity is independent of the concise insight selection used by normal stages.
fixtures.manyinsights = {
  ...fixtures.transform,
  METRICS: [metric('Checks passed', 18, 20), metric('Behaviors', 22, 24),
    metric('Slices', 4, 7), metric('Pilot', 'In review')],
  ROWS: [row('API', 'Verified', 'is-done'), row('UI', 'In progress'), row('Data', 'Pending', 'is-pending'),
    row('Repairs', '2', 'is-blocked'), row('Reviewer', 'Assigned'), row('Consumers', 'Unverified', 'is-pending')],
};
// These fixtures are already-normalized evidence. Provider retrieval, status/label
// interpretation, and artifact classification are adapter responsibilities, not
// runtime code hidden in the renderer. No real tenant identifiers are used.
fixtures.nativereview = {
  ...fixtures.brief, METRICS: [], ROWS: [row('Brief review', 'Awaiting review')],
};
fixtures.agentreview = {
  ...fixtures.transform, METRICS: [], ROWS: [row('Technical review', 'Awaiting review')],
  ISSUES_SUMMARY: 'Active issues · 2',
  ISSUES: fixtures.transform.ISSUES.map(issue => ({ ...issue, USER_REQUIRED: false })),
};
fixtures.clarification = {
  ...fixtures.initialize, METRICS: [], ROWS: [row('Intent', 'Needs your input')],
};
fixtures.acceptedstalemarker = {
  ...fixtures.complete, METRICS: [], ROWS: [row('Final verification', 'Accepted', 'is-done')],
};
fixtures.canceled = {
  ...fixtures.transform, METRICS: [metric('Accepted slices', 4, 6)],
  ROWS: [row('Excluded scope', '1 canceled', 'is-pending')],
};
fixtures.burndown = {
  ...fixtures.transform, CURRENT_SCOPE: 'Phase 2 · API', SCOPE_VISIBLE: true,
  BURNDOWN_POINTS: [[0, 0, 100, false], [2, 2, 90, false], [4, 4, 80, false], [7, 4, 80, false], [10, 7, 55, false],
    [11, 7, 55, false], [12, 8, 50, false], [13, 8, 50, false], [14, 9, 45, false]],
};

// Give every fixed scenario a second provider identity and different issue keys.
// Fixture-only URL rewriting makes synthetic samples; live URLs must be verified.
const jiraUrl = url => url.replace('https://example.com/linear/', 'https://tracker.example.net/jira/')
  .replaceAll('DEMO-', 'MIGRATE42-');
for (const [name, value] of Object.entries(fixtures)) fixtures[`jira_${name}`] = {
  ...value, MIGRATION_ID: 'jira:example-site:10001',
  MIGRATION_HOME_LABEL: 'Open Jira migration',
  MIGRATION_HOME_URL: value.MIGRATION_HOME_VISIBLE ? 'https://tracker.example.net/browse/MIGRATE42-1' : '',
  METRICS: value.METRICS.map(item => ({ ...item, URL: jiraUrl(item.URL) })),
  ISSUES: value.ISSUES.map(item => ({ ...item, LABEL: item.LABEL.replaceAll('DEMO-', 'MIGRATE42-'), URL: jiraUrl(item.URL) })),
  RESOURCES: value.RESOURCES.map((item, n) => ({ ...item,
    URL: `https://tracker.example.net/browse/MIGRATE42-${8000 + n}` })),
};
// An active native status with the fallback review label supplies exactly the same
// logical review state as native In Review. Human action remains a separate flag.
fixtures.jira_fallbackreview = { ...fixtures.jira_nativereview };
fixtures.jira_confluence = {
  ...fixtures.jira_target,
  RESOURCES: fixtures.jira_target.RESOURCES.map((item, n) => ({ ...item,
    URL: `https://docs.example.org/wiki/spaces/ENGINEERING/pages/${5000 + n}` })),
};
fixtures.jira_reportartifact = {
  ...fixtures.jira_phaseverification,
  RESOURCES_SUMMARY: 'Recent resources · 2',
  RESOURCES: [
    { LABEL: 'Phase verification report', URL: 'https://tracker.example.net/browse/MIGRATE42-8000', RECENCY: 'Updated 8 Oct 2026, 10:30 UTC' },
    { LABEL: 'Migration brief', URL: 'https://tracker.example.net/browse/MIGRATE42-8001', RECENCY: 'Updated 8 Oct 2026, 10:15 UTC' },
  ],
};
// Git supplies the same normalized contract; these URLs are dummy published data.
fixtures.git_published = {
  ...fixtures.transform, MIGRATION_ID: 'git:example-repository:dummy-migration',
  CURRENT_SCOPE: fixtures.burndown.CURRENT_SCOPE, SCOPE_VISIBLE: true, BURNDOWN_POINTS: fixtures.burndown.BURNDOWN_POINTS,
  MIGRATION_HOME_LABEL: 'Open Git migration',
  MIGRATION_HOME_URL: 'https://example.com/repo/blob/fixture/.codemod/migrations/demo/README.md',
  METRICS: fixtures.transform.METRICS.map(item => ({ ...item, URL: '', LINK_VISIBLE: false })),
  ISSUES: fixtures.transform.ISSUES.map((item, n) => ({ ...item,
    URL: `https://example.com/repo/blob/fixture/.codemod/migrations/demo/work/WORK-${n + 1}.md` })),
  RESOURCES: fixtures.transform.RESOURCES.map((item, n) => ({ ...item,
    URL: `https://example.com/repo/blob/fixture/.codemod/migrations/demo/reports/report-${n + 1}.md` })),
};
fixtures.git_local = {
  ...fixtures.git_published, MIGRATION_HOME_VISIBLE: false, MIGRATION_HOME_URL: '',
  ISSUES: [], ISSUES_VISIBLE: false, RESOURCES: [], RESOURCES_VISIBLE: false,
  ROWS: [row('Active work', '2 · file links in chat'), row('Reports', '2 · local only')],
  FRESHNESS_WARNING: 'Local records; file links are in chat.', FRESHNESS_WARNING_VISIBLE: true,
};
fixtures.space_review = {
  ...stage(0), MIGRATION_ID: 'chatgpt-space:example-workspace:space-1:home',
  MIGRATION_HOME_LABEL: 'Open ChatGPT Space migration', MIGRATION_HOME_URL: 'https://example.com/pages/home',
  ISSUES_SUMMARY: 'Active issues · 1 · 🚩 1',
  ISSUES: [{ LABEL: 'page_review — Define migration intent', URL: 'https://example.com/pages/page_review', USER_REQUIRED: true }],
  ROWS: [row('Workflow access', 'Blocked on intent acceptance', 'is-blocked')],
  RESOURCES: [{ LABEL: 'Migration intent', URL: 'https://example.com/pages/intent', RECENCY: 'Update time unknown' }],
};
fixtures.burndown_early = {
  ...fixtures.burndown, BURNDOWN_POINTS: [[0, 0, 100, false], [1, 1, 100, false], [3, 1, 100, false], [4, 2, 75, false]],
};
for (const fixture of Object.values(fixtures)) {
  fixture.ISSUES_SUMMARY_LABEL = fixture.ISSUES_SUMMARY.replace(/🚩 (\d+)/,
    (_, count) => `${count} ${count === '1' ? 'needs' : 'need'} you`);
}

// Fixtures follow the fragment's escaped-placeholder and repeatable-block contract.
// This helper populates preview HTML; only the optional burndown uses client-side
// code, for presentation of normalized evidence already included in the fragment.
function render(values) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const validateUrl = (value, key) => {
    assert.equal(new URL(value).protocol, 'https:', `${key}: HTTPS required`);
  };
  for (const key of ['MIGRATION_ID', 'MIGRATION_NAME', 'MIGRATION_HOME_LABEL']) {
    assert.equal(typeof values[key], 'string', `${key}: string required`);
    assert(values[key].trim(), `${key}: nonempty value required`);
  }
  assert.equal(typeof values.MIGRATION_HOME_VISIBLE, 'boolean', 'MIGRATION_HOME_VISIBLE: boolean required');
  assert.equal(typeof values.MIGRATION_HOME_URL, 'string', 'MIGRATION_HOME_URL: string required');
  if (values.MIGRATION_HOME_VISIBLE) assert(values.MIGRATION_HOME_URL.trim(), 'Visible migration home requires URL');
  for (const [key, value] of Object.entries(values)) {
    if (key.endsWith('_URL') && value) validateUrl(value, key);
  }
  for (const name of ['METRICS', 'ROWS', 'ISSUES', 'RESOURCES']) {
    assert(Array.isArray(values[name]), `${name}: array required`);
    for (const [index, item] of values[name].entries()) {
      const prefix = `${name}[${index}]`;
      assert(item && typeof item === 'object' && !Array.isArray(item), `${prefix}: object required`);
      const keys = ['LABEL', ...(name === 'ISSUES' || name === 'RESOURCES' ? ['URL'] : ['VALUE']),
        ...(name === 'RESOURCES' ? ['RECENCY'] : [])];
      for (const key of keys) {
        assert.equal(typeof item[key], 'string', `${prefix}.${key}: string required`);
        assert(item[key].trim(), `${prefix}.${key}: nonempty value required`);
      }
      if (name === 'ISSUES' || name === 'RESOURCES' || item.URL) validateUrl(item.URL, `${prefix}.URL`);
      if (name === 'ISSUES') assert.equal(typeof item.USER_REQUIRED, 'boolean', `${prefix}.USER_REQUIRED: boolean required`);
      if (name === 'METRICS' || name === 'ROWS') {
        assert(['is-active', 'is-done', 'is-blocked', 'is-pending'].includes(item.STATE), `${prefix}.STATE: supported state required`);
      }
      if (name === 'METRICS') {
        for (const key of ['BAR_VISIBLE', 'LINK_VISIBLE']) {
          assert.equal(typeof item[key], 'boolean', `${prefix}.${key}: boolean required`);
        }
        assert.equal(typeof item.URL, 'string', `${prefix}.URL: string required`);
        if (item.LINK_VISIBLE) assert(item.URL.trim(), `${prefix}.URL: visible link requires URL`);
        if (item.BAR_VISIBLE) {
          for (const key of ['NOW', 'MAX', 'PERCENT']) {
            assert(typeof item[key] === 'number' && Number.isFinite(item[key]), `${prefix}.${key}: finite number required`);
          }
          assert(item.MAX > 0 && item.NOW >= 0 && item.NOW <= item.MAX, `${prefix}: valid bar range required`);
          assert(item.PERCENT >= 0 && item.PERCENT <= 100, `${prefix}.PERCENT: 0 to 100 required`);
          assert(Math.abs(item.PERCENT - 100 * item.NOW / item.MAX) < 1e-9, `${prefix}.PERCENT: must match the measured ratio`);
        } else {
          for (const key of ['NOW', 'MAX', 'PERCENT']) assert.equal(item[key], '', `${prefix}.${key}: hidden bar requires blank numeric fields`);
        }
      }
    }
  }
  const scalar = (template, scope) => template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    assert(Object.hasOwn(scope, key), `Missing fixture value: ${key}`);
    assert(['string', 'number', 'boolean'].includes(typeof scope[key]), `${key}: scalar required`);
    return escape(scope[key]);
  });
  // Expand each block once without reinterpreting placeholders in inserted text.
  const token = /\{\{#(METRICS|ROWS|ISSUES|RESOURCES)\}\}([\s\S]*?)\{\{\/\1\}\}|\{\{([A-Z0-9_]+)\}\}/g;
  assert(!/\{\{|\}\}/.test(asset.replace(token, '')), 'Unrecognized or unmatched template marker');
  const populated = asset.replace(token, (match, name, body, key) => {
    if (!name) return scalar(match, values);
    assert(!/\{\{|\}\}/.test(body.replace(/\{\{[A-Z0-9_]+\}\}/g, '')), `${name}: invalid item template`);
    return values[name].map(item => scalar(body, item)).join('');
  });
  assert.equal(populated.split(burndownSlot).length, 2, 'Exactly one Transform burndown insertion point');
  assert(Array.isArray(values.BURNDOWN_POINTS), 'BURNDOWN_POINTS: array required');
  if (!values.BURNDOWN_POINTS.length) return populated.replace(burndownSlot, '');
  assert.equal(values.STEP_5_CURRENT, 'step', 'Transform burndown requires step 5');
  assert(values.SCOPE_VISIBLE && values.CURRENT_SCOPE.trim(), 'Transform burndown requires a displayed phase scope');
  return populated.replace(burndownSlot, () => scalar(burndownAsset, { BURNDOWN_POINTS: JSON.stringify(values.BURNDOWN_POINTS) }));
}
module.exports = { fixtures, render };

function checkTemplateContract() {
  const localGit = render(fixtures.git_local);
  assert(localGit.includes('2 · file links in chat'), 'Local-only Git retains work counts without HTTPS links');
  assert(!localGit.includes('https://example.com/repo/'), 'Local Git does not advertise published records');
  assert(!fixtures.git_published.ISSUES.some(issue =>
    fixtures.git_published.RESOURCES.some(resource => resource.URL === issue.URL)), 'Git reports are not work');
  assert.equal(render(fixtures.jira_nativereview), render(fixtures.jira_fallbackreview), 'Native and fallback review have the same display contract');
  assert.throws(() => render({ ...fixtures.burndown, STEP_5_CURRENT: 'false' }), /requires step 5/);
  assert.throws(() => render({ ...fixtures.burndown, SCOPE_VISIBLE: false }), /displayed phase scope/);
  for (const name of ['jira_reportartifact', 'jira_confluence', 'space_review']) {
    assert(!fixtures[name].ISSUES.some(issue => fixtures[name].RESOURCES.some(resource => resource.URL === issue.URL)), `${name}: artifact records do not become active work items`);
  }
  assert.throws(() => render({ ...fixtures.transform, MIGRATION_HOME_VISIBLE: 'false' }), /boolean required/);
  assert.throws(() => render({ ...fixtures.transform, MIGRATION_HOME_URL: '' }), /Visible migration home requires URL/);
  assert.throws(() => render({ ...fixtures.transform, MIGRATION_HOME_LABEL: '' }), /nonempty value required/);
  for (const list of ['METRICS', 'ROWS', 'ISSUES', 'RESOURCES']) {
    assert.throws(() => render({ ...fixtures.transform, [list]: null }), /array required/);
    assert.throws(() => render({ ...fixtures.transform, [list]: [null] }), /object required/);
    assert.throws(() => render({ ...fixtures.transform, [list]: [{}] }), /string required/);
  }
  for (const list of ['METRICS', 'ISSUES', 'RESOURCES']) {
    assert.throws(() => render({ ...fixtures.transform,
      [list]: [{ ...fixtures.transform[list][0], URL: 'javascript:alert(1)' }] }), /HTTPS required/);
  }
  const invalidMetric = (changes, expected) => assert.throws(() => render({ ...fixtures.transform,
    METRICS: [{ ...fixtures.transform.METRICS[0], ...changes }] }), expected);
  for (const key of ['BAR_VISIBLE', 'LINK_VISIBLE']) invalidMetric({ [key]: 'false' }, /boolean required/);
  for (const key of ['NOW', 'MAX', 'PERCENT']) {
    for (const value of [NaN, Infinity, '10; background: url(https://example.com)']) {
      invalidMetric({ [key]: value }, /finite number required/);
    }
  }
  for (const changes of [{ NOW: -1 }, { NOW: 8 }, { MAX: 0 }]) invalidMetric(changes, /valid bar range required/);
  for (const value of [-1, 101]) invalidMetric({ PERCENT: value }, /0 to 100 required/);
  invalidMetric({ PERCENT: 90 }, /must match the measured ratio/);
  invalidMetric({ BAR_VISIBLE: false }, /hidden bar requires blank numeric fields/);
  invalidMetric({ STATE: 'is-active extra-class' }, /supported state required/);
  invalidMetric({ URL: '' }, /visible link requires URL/);
  assert.throws(() => render({ ...fixtures.transform,
    ROWS: [{ ...fixtures.transform.ROWS[0], STATE: 'unknown' }] }), /supported state required/);
  assert.throws(() => render({ ...fixtures.transform,
    ISSUES: [{ ...fixtures.transform.ISSUES[0], USER_REQUIRED: 'false' }] }), /boolean required/);
  assert.throws(() => render({ ...fixtures.transform,
    RESOURCES: [{ ...fixtures.transform.RESOURCES[0], LABEL: '' }] }), /nonempty value required/);
  const text = '<img src=x onerror=alert(1)> & "quoted" {{CURRENT_STEP}} {{#ISSUES}}';
  const literal = render({ ...fixtures.single, MIGRATION_HOME_LABEL: text,
    METRICS: [{ ...fixtures.single.METRICS[0], LABEL: text, VALUE: text }],
    ROWS: [row(text, text)],
    ISSUES: [{ ...fixtures.single.ISSUES[0], LABEL: text }],
    RESOURCES: [{ ...fixtures.single.RESOURCES[0], LABEL: text, RECENCY: text }] });
  assert(literal.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quoted&quot; {{CURRENT_STEP}} {{#ISSUES}}'), 'Item text is escaped once and never reinterpreted as template syntax');
  assert(!literal.includes('&amp;lt;img'), 'Item text is not double escaped');
  assert(!literal.includes('<img'), 'Item text cannot inject markup');
  for (const values of Object.values(fixtures)) assert(!/\{\{|\}\}/.test(render(values)), 'All fixture template markers expanded');
}

async function run() {
  checkTemplateContract();
  assert(process.env.VISUALIZE_HOST_CSS, 'Set VISUALIZE_HOST_CSS to the installed visualize.css');
  const css = fs.readFileSync(process.env.VISUALIZE_HOST_CSS, 'utf8');
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    const reopened = [...fixtures.burndown.BURNDOWN_POINTS, [15, 10, 40, true]];
    for (const [name, points, expected, elapsedExpected] of [
      ['unchanged net work', [...fixtures.burndown.BURNDOWN_POINTS, [15, 10, 45, true]], '—'],
      ['decreased net work', reopened, '—'],
      ['post-reopen rates', [...reopened, [16, 11, 37, false], [18, 13, 25, false]], '4.2–8.3h'],
      ['equal observed rates', [[0, 0, 100, false], [1, 1, 90, false], [3, 2, 80, false]], '~8h', '~12h'],
      ['batched acceptance', [[0, 0, 100, false], [2, 2, 60, false], [4, 3, 50, false]], '2.5–5h', '3.3–6.7h'],
      ['split acceptance during idle', [[0, 0, 100, false], [2, 2, 80, false], [3, 2, 60, false], [4, 3, 50, false]], '2.5–5h', '3.3–6.7h'],
      ['reversed acceptance weights during idle', [[0, 0, 100, false], [2, 2, 70, false], [3, 2, 60, false], [4, 3, 50, false]], '2.5–5h', '3.3–6.7h'],
      ['reopen within idle group', [[0, 0, 100, false], [2, 2, 80, false], [3, 2, 90, true], [4, 2, 70, false], [5, 3, 60, false], [7, 5, 50, false]], '5–10h', '7–14h'],
    ]) {
      await page.setContent(`<style>${css}</style>${render({ ...fixtures.burndown, BURNDOWN_POINTS: points })}`);
      assert.equal(await page.locator('#codemod-transform-burndown [data-value="left"]').innerText(), expected, name);
      if (expected.startsWith('~')) {
        assert.equal(await page.locator('#codemod-burndown-plot [stroke-dasharray]').count(), 1, `${name}: forecast line`);
        assert.equal(await page.locator('#codemod-burndown-plot polygon').count(), 0, `${name}: no range band`);
        assert.match(await page.locator('#codemod-burndown-plot').getAttribute('aria-label'), /Estimated about .* active hours left/, name);
      }
      if (elapsedExpected) {
        await page.getByRole('button', { name: 'Include idle time' }).click();
        assert.equal(await page.locator('#codemod-transform-burndown [data-value="left"]').innerText(), elapsedExpected, `${name}: elapsed mode`);
      }
    }
    if (process.env.SCREENSHOT_DIR) fs.mkdirSync(process.env.SCREENSHOT_DIR, { recursive: true });
    let cases = 0, maxCompactHeight = 0;
    for (const width of [240, 272, 300]) for (const theme of ['light', 'dark']) {
      for (const [name, values] of Object.entries(fixtures)) {
        const scenario = name.replace(/^jira_/, '');
        const label = `${width}-${theme}-${name}`;
        await page.setViewportSize({ width, height: 1200 });
        await page.emulateMedia({ colorScheme: theme });
        await page.setContent(`<style>${css}html>body{padding:0;--font-size-base:14px}</style><div id="fixture-host"><div id="fixture-title" role="heading" aria-level="1" style="margin-bottom:12px;color:var(--muted-foreground);overflow-wrap:anywhere"></div>${render(values)}</div>`);
        // The application owns the live-view title; keep its fixture outside the fragment.
        await page.locator('#fixture-title').evaluate((element, title) => { element.textContent = title; }, values.MIGRATION_NAME);
        const root = page.locator('#codemod-progress-view');
        assert.equal(await root.getAttribute('data-migration-id'), values.MIGRATION_ID, `${label}: qualified migration identity`);
        const inspectGeometry = () => root.evaluate(element => {
          const visible = el => el.getClientRects().length > 0;
          const bounds = element.getBoundingClientRect();
          const bad = [];
          for (const el of element.querySelectorAll('*')) {
            if (!visible(el)) continue;
            const box = el.getBoundingClientRect();
            if (box.left < bounds.left - 1 || box.right > bounds.right + 1
                || (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)) bad.push(el.outerHTML.slice(0, 100));
          }
          for (const row of element.querySelectorAll('.cpv-row')) {
            if (!visible(row)) continue;
            const [a, b] = [...row.children].slice(1).map(el => el.getBoundingClientRect());
            if (a.width < 1 || b.width < 1 || (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)) {
              bad.push(`Overlapping or collapsed row: ${row.textContent}`);
            }
          }
          return { bad, height: bounds.height, overflow: element.scrollWidth > element.clientWidth + 1 };
        });
        const geometry = await inspectGeometry();
        assert.deepEqual(geometry.bad, [], `${label}: bounds and row overlap`);
        assert(!geometry.overflow, `${label}: horizontal overflow`);
        if (!values.BURNDOWN_POINTS.length && !['stress', 'manyinsights'].includes(scenario)) {
          maxCompactHeight = Math.max(maxCompactHeight, geometry.height);
          assert(geometry.height <= 440, `${label}: compact height ${geometry.height}`);
        }
        assert.equal(await root.locator('.cpv-segment').count(), steps.length, `${label}: all stage positions`);
        assert.equal(await root.locator('.cpv-segment[aria-current="step"]').count(), 1, `${label}: one current stage`);
        assert.equal(await root.locator('.cpv-metric:visible').count(), values.METRICS.length, `${label}: repeatable metric count`);
        assert.equal(await root.locator('.cpv-row:visible').count(), values.ROWS.length, `${label}: repeatable status row count`);
        assert.equal(await root.getByRole('progressbar').count(), values.METRICS.filter(item => item.BAR_VISIBLE).length, label);
        for (const [n, item] of values.METRICS.entries()) {
          const metric = root.locator('.cpv-metric').nth(n);
          assert((await metric.getAttribute('class')).split(/\s+/).includes(item.STATE), `${label}: metric ${n} state preserved`);
          assert.equal((await metric.locator('.cpv-label').innerText()).trim(), item.LABEL, `${label}: metric order and label preserved`);
          assert.equal(await metric.locator('.cpv-value').innerText(), item.VALUE, `${label}: metric ${n} value preserved`);
          if (item.BAR_VISIBLE) {
            const bar = metric.getByRole('progressbar');
            assert.equal(await bar.getAttribute('aria-label'), item.LABEL, `${label}: bar label`);
            assert.equal(await bar.getAttribute('aria-valuenow'), String(item.NOW), `${label}: measured numerator`);
            assert.equal(await bar.getAttribute('aria-valuemax'), String(item.MAX), `${label}: measured denominator`);
            const percent = await metric.locator('.cpv-fill').evaluate(element => element.style.getPropertyValue('--value'));
            assert.equal(Number.parseFloat(percent), item.PERCENT, `${label}: measured ratio`);
          }
        }
        for (const [n, item] of values.ROWS.entries()) {
          const row = root.locator('.cpv-row').nth(n);
          assert((await row.getAttribute('class')).split(/\s+/).includes(item.STATE), `${label}: row ${n} state preserved`);
          assert.equal(await row.locator('span').nth(1).innerText(), item.LABEL, `${label}: row order and label preserved`);
          assert.equal(await row.locator('.cpv-value').innerText(), item.VALUE, `${label}: row ${n} value preserved`);
        }
        assert.equal(await root.locator('script').count(), values.BURNDOWN_POINTS.length ? 1 : 0, `${label}: only the optional trusted chart script is present`);
        assert.equal(await page.evaluate(() => window.injected), undefined, `${label}: text cannot inject markup`);
        assert.equal(await root.locator('.cpv-issues li').count(), values.ISSUES.length, `${label}: repeatable issue count`);
        assert.equal(await root.locator('.cpv-resources li').count(), values.RESOURCES.length, `${label}: repeatable resource count`);
        assert.doesNotMatch(await root.textContent(), /Next:/, `${label}: no next-action row`);
        assert.equal(await root.locator('.cpv-title').getAttribute('data-tooltip'), values.FRESHNESS, `${label}: last checked in heading tooltip`);
        const visibleText = await root.innerText();
        assert(!visibleText.includes(values.FRESHNESS), `${label}: last checked does not appear in visible content`);
        assert.equal(await root.locator('.cpv-freshness:visible').count(), values.FRESHNESS_WARNING_VISIBLE ? 1 : 0, `${label}: visible freshness warning only when needed`);
        if (values.FRESHNESS_WARNING_VISIBLE) {
          assert(values.FRESHNESS_WARNING, `${label}: visible freshness warning has content`);
          assert(visibleText.includes(values.FRESHNESS_WARNING), `${label}: stale or unavailable evidence remains visible`);
        }
        assert.equal(await root.locator('.cpv-note:visible').count(), values.DECISIONS_BLOCKERS_VISIBLE ? 1 : 0, `${label}: show only meaningful decision or blocker notes`);
        if (values.DECISIONS_BLOCKERS_VISIBLE) {
          assert(values.DECISIONS_BLOCKERS, `${label}: visible note has content`);
          assert(visibleText.includes(values.DECISIONS_BLOCKERS), `${label}: blockers preserved`);
        }
        assert.doesNotMatch(visibleText, /None recorded/, `${label}: no empty blocker filler`);
        const links = await root.getByRole('link').evaluateAll(elements => elements.map(el => ({
          href: el.getAttribute('href'), target: el.getAttribute('target'), rel: el.getAttribute('rel'),
        })));
        const expectedLinks = [...(values.MIGRATION_HOME_VISIBLE ? [values.MIGRATION_HOME_URL] : []),
          ...values.METRICS.filter(item => item.LINK_VISIBLE).map(item => item.URL)];
        assert.equal(links.length, expectedLinks.length, `${label}: visible links`);
        assert.deepEqual(links.map(link => link.href), expectedLinks, `${label}: migration-home and metric links preserve order`);
        for (const link of links) {
          assert.equal(new URL(link.href).protocol, 'https:', label);
          assert.equal(link.target, '_blank', label);
          assert.match(link.rel, /noopener/, label);
        }
        const issues = root.locator('.cpv-issues');
        assert.equal(await issues.evaluate(element => element.open), false, `${label}: issue list starts collapsed`);
        assert.equal(await issues.isVisible(), values.ISSUES_VISIBLE, `${label}: issue section visibility`);
        assert.equal(await issues.getByRole('link').count(), 0, `${label}: collapsed issues are not interactive`);
        const resources = root.locator('.cpv-resources');
        assert.equal(await resources.evaluate(element => element.open), false, `${label}: resource list starts collapsed`);
        assert.equal(await resources.isVisible(), values.RESOURCES_VISIBLE, `${label}: resource section visibility`);
        assert.equal(await resources.getByRole('link').count(), 0, `${label}: collapsed resources are not interactive`);
        if (values.ISSUES_VISIBLE) {
          const summary = issues.locator('summary');
          assert.equal((await summary.innerText()).trim(), values.ISSUES_SUMMARY, `${label}: issue total is explicit`);
          assert.equal(await summary.getAttribute('aria-label'), values.ISSUES_SUMMARY_LABEL, `${label}: accessible summary explains the attention count`);
          assert.equal(await summary.getAttribute('data-tooltip'), values.ISSUES_SUMMARY_LABEL, `${label}: summary tooltip explains the attention count`);
          await summary.click();
          assert.equal(await issues.evaluate(element => element.open), true, `${label}: native disclosure expands`);
          assert.equal(await issues.getByRole('link').count(), values.ISSUES.length, `${label}: all active issues are shown`);
          assert.equal(await issues.locator('.cpv-attention:visible').count(), values.ISSUES.filter(issue => issue.USER_REQUIRED).length, `${label}: only explicitly labelled issues show attention`);
          let passedUserRequired = false;
          for (const [n, item] of values.ISSUES.entries()) {
            if (!item.USER_REQUIRED) passedUserRequired = true;
            else assert(!passedUserRequired, `${label}: user-required issues are selected first`);
            const issue = issues.getByRole('link', { name: item.LABEL, exact: true });
            assert.equal(await issue.count(), 1, `${label}: issue ${n} uses its ID and title`);
            assert.equal(await issues.locator('li a').nth(n).innerText(), item.LABEL, `${label}: supplied issue order retained`);
            assert.equal(await issue.getAttribute('href'), item.URL, `${label}: issue ${n} URL`);
            assert.match(await issue.innerText(), /^\S+ — .+/, `${label}: human-readable issue label`);
            const marker = issue.locator('..').locator('.cpv-attention');
            assert.equal(await marker.isVisible(), item.USER_REQUIRED, `${label}: issue ${n} retains its explicit user-action flag`);
            if (item.USER_REQUIRED) {
              assert.equal((await marker.innerText()).trim(), '🚩', `${label}: compact attention marker`);
              assert.equal(await marker.getAttribute('role'), 'img', `${label}: emoji has an accessible role`);
              for (const attribute of ['aria-label', 'data-tooltip']) {
                assert.equal(await marker.getAttribute(attribute), 'Needs your input, review or action', `${label}: attention meaning remains explicit in ${attribute}`);
              }
            }
          }
          for (const issue of await issues.getByRole('link').all()) {
            assert.equal(new URL(await issue.getAttribute('href')).protocol, 'https:', label);
            assert.equal(await issue.getAttribute('target'), '_blank', label);
            assert.match(await issue.getAttribute('rel'), /noopener/, label);
          }
          assert.equal(await resources.evaluate(element => element.open), false, `${label}: expanding issues leaves resources closed`);
          const expanded = await inspectGeometry();
          assert.deepEqual(expanded.bad, [], `${label}: expanded list bounds and overlap`);
          assert(!expanded.overflow, `${label}: expanded list horizontal overflow`);
          if (process.env.SCREENSHOT_DIR && ['target', 'manyissues', 'brief'].includes(name) && width === 272) {
            await page.locator('#fixture-host').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${label}-expanded.png`) });
          }
          await summary.click();
        }
        if (values.RESOURCES_VISIBLE) {
          const summary = resources.locator('summary');
          assert.equal((await summary.innerText()).trim(), values.RESOURCES_SUMMARY, `${label}: resource summary`);
          await summary.click();
          assert.equal(await resources.evaluate(element => element.open), true, `${label}: native resource disclosure expands`);
          assert.equal(await issues.evaluate(element => element.open), false, `${label}: expanding resources leaves issues closed`);
          assert.equal(await resources.getByRole('link').count(), values.RESOURCES.length, `${label}: all migration resources are shown`);
          const resourceLinks = resources.getByRole('link');
          for (const [n, item] of values.RESOURCES.entries()) {
            const resource = resources.getByRole('link', { name: item.LABEL, exact: true });
            assert.equal(await resource.count(), 1, `${label}: resource ${n} uses its document title`);
            assert.equal(await resourceLinks.nth(n).innerText(), item.LABEL, `${label}: recorded resource ordering retained`);
            assert.equal(await resource.getAttribute('href'), item.URL, `${label}: resource ${n} URL`);
            assert.equal(await resource.getAttribute('data-tooltip'), item.RECENCY, `${label}: resource ${n} recency metadata`);
          }
          for (const resource of await resourceLinks.all()) {
            assert.equal(new URL(await resource.getAttribute('href')).protocol, 'https:', label);
            assert.equal(await resource.getAttribute('target'), '_blank', label);
            assert.match(await resource.getAttribute('rel'), /noopener/, label);
          }
          const expanded = await inspectGeometry();
          assert.deepEqual(expanded.bad, [], `${label}: expanded resource bounds and overlap`);
          assert(!expanded.overflow, `${label}: expanded resources do not overflow horizontally`);
          if (process.env.SCREENSHOT_DIR && ['target', 'manyissues'].includes(name) && width === 272) {
            await page.locator('#fixture-host').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${label}-resources-expanded.png`) });
          }
          await summary.click();
        }
        if (scenario === 'unknown') {
          assert.match(visibleText, /Evidence\s+Unavailable/, `${label}: unknown evidence stays explicit`);
          assert.doesNotMatch(visibleText, /0 issues|No active issues/, `${label}: missing evidence is not zero work`);
        }
        if (['brief', 'statusonly'].includes(scenario)) {
          assert.equal(await root.locator('.cpv-metric:visible, .cpv-row:visible').count(), 1, `${label}: a single meaningful insight is enough`);
          assert.equal(await root.getByRole('progressbar').count(), 0, `${label}: approval is a state, not a percentage`);
          assert.match(visibleText, /Brief approval\s+Awaiting user/, `${label}: required human approval stays explicit`);
        }
        if (scenario === 'transform') assert.match(visibleText, /Dev tests passed[\s\S]+Phase verification\s+Pending[\s\S]+Open repairs\s+2/, `${label}: development checks do not imply independent verification`);
        if (scenario === 'target') assert.match(visibleText, /Behaviors verified[\s\S]+Checks passed[\s\S]+Failed tests[\s\S]+Unverified behaviors/, `${label}: target outcomes and gaps remain visible`);
        if (['nativereview', 'fallbackreview', 'agentreview'].includes(scenario)) {
          assert.match(visibleText, /Awaiting review/, `${label}: logical review state`);
          assert(!values.STEP_4_LABEL.endsWith('completed') || scenario === 'agentreview', `${label}: brief review is not acceptance`);
          assert.equal(values.ISSUES.some(issue => issue.USER_REQUIRED), scenario !== 'agentreview', `${label}: human action is independent of review`);
        }
        if (scenario === 'clarification') {
          assert.match(visibleText, /Needs your input/, `${label}: unfinished human action`);
          assert.doesNotMatch(visibleText, /Awaiting review/, `${label}: clarification is not submitted review`);
        }
        if (scenario === 'acceptedstalemarker') {
          assert.match(visibleText, /Accepted/, `${label}: current acceptance survives stale native markers`);
          assert.doesNotMatch(visibleText, /🚩|Awaiting review/, `${label}: adapter-cleared stale markers do not reappear`);
        }
        if (scenario === 'canceled') {
          assert.match(visibleText, /1 canceled/, `${label}: approved excluded scope remains explicit`);
          assert.equal(values.METRICS[0].NOW, 4, `${label}: canceled work is not an accepted slice`);
        }
        const projectSection = root.locator('.cpv-project');
        assert(!(await root.textContent()).includes(values.MIGRATION_NAME), `${label}: migration name is not duplicated in fragment`);
        const projectLink = projectSection.getByRole('link', { name: values.MIGRATION_HOME_LABEL, exact: true });
        assert.equal(await projectLink.count(), values.MIGRATION_HOME_VISIBLE ? 1 : 0, `${label}: accessible migration-home action`);
        const header = await root.locator('.cpv-header').boundingBox();
        const track = await root.locator('.cpv-track').boundingBox();
        const separators = root.locator(':scope > hr');
        assert.equal(await separators.count(), 2, `${label}: dividers before insights and records`);
        const divider = await separators.nth(0).boundingBox();
        const recordsDivider = await separators.nth(1).boundingBox();
        const insights = root.locator('.cpv-metric:visible, .cpv-row:visible, .cpv-note:visible, #codemod-transform-burndown:visible');
        assert(await insights.count() > 0, `${label}: show relevant evidence or an explicit unavailable state`);
        const firstInsight = await insights.first().boundingBox();
        const lastInsight = await insights.last().boundingBox();
        assert(header.y + header.height <= track.y && track.y + track.height <= divider.y
          && divider.y + divider.height <= firstInsight.y, `${label}: heading > stages > divider > insights order`);
        assert(lastInsight.y + lastInsight.height <= recordsDivider.y, `${label}: records divider follows step insights`);
        for (const section of [issues, resources]) {
          if (!await section.isVisible()) continue;
          const bounds = await section.boundingBox();
          assert(recordsDivider.y + recordsDivider.height <= bounds.y, `${label}: records divider precedes disclosure lists`);
        }
        if (values.MIGRATION_HOME_VISIBLE) {
          const classes = (await projectLink.getAttribute('class')).split(/\s+/);
          for (const name of ['btn', 'btn-primary', 'btn-block']) {
            assert(classes.includes(name), `${label}: migration-home action uses host ${name} styling`);
          }
          const project = await projectLink.boundingBox();
          const bounds = await root.boundingBox();
          assert(project.y + project.height <= header.y, `${label}: migration-home action before heading and stages`);
          assert(Math.abs(project.x - bounds.x) <= 1 && Math.abs(project.width - bounds.width) <= 1,
            `${label}: migration-home action fills available width`);
          const background = await projectLink.evaluate(element => getComputedStyle(element).backgroundColor);
          assert(!['transparent', 'rgba(0, 0, 0, 0)'].includes(background), `${label}: primary migration-home action has a filled background`);
        }
        if (['phaseverification', 'reportartifact'].includes(scenario)) {
          assert.equal(await root.locator('.cpv-segment').nth(steps.indexOf('Transform')).getAttribute('aria-current'), 'step', label);
          assert.match(await root.locator('.cpv-segment').nth(steps.length - 1).getAttribute('class'), /is-pending/, `${label}: final verification remains pending`);
        }
        if (values.BURNDOWN_POINTS.length) {
          const chart = root.locator('#codemod-transform-burndown');
          assert(await chart.isVisible(), `${label}: Transform chart visible`);
          assert.equal(await chart.locator('details').evaluate(element => element.open), true, `${label}: burndown starts open`);
          assert.equal(await root.getByRole('separator').count(), 3, `${label}: dividers surround burndown and records`);
          const before = await chart.locator('svg').getAttribute('aria-label');
          assert.match(before, /active hours/, `${label}: active-time basis`);
          const button = chart.getByRole('button', { name: 'Include idle time' });
          assert.equal(await button.getAttribute('aria-pressed'), 'false', `${label}: idle starts excluded`);
          assert.equal(await chart.locator('[data-label="left"]').innerText(), 'Active time left', `${label}: active estimate label`);
          if (scenario === 'burndown_early') {
            assert.equal(await chart.locator('[data-value="left"]').innerText(), '—', `${label}: insufficient evidence cannot produce a forecast`);
          } else {
            assert.equal(await chart.locator('[data-value="left"]').innerText(), '5.4–9h', `${label}: observed-rate forecast`);
          }
          await button.click();
          assert.equal(await button.getAttribute('aria-pressed'), 'true', `${label}: idle selection is visible`);
          assert.equal(await chart.locator('[data-label="left"]').innerText(), 'Elapsed time left', `${label}: elapsed estimate label`);
          assert.match(await chart.locator('svg').getAttribute('aria-label'), /elapsed hours/, `${label}: elapsed-time basis`);
          assert(await chart.locator('[data-idle-period]').count() > 0, `${label}: idle intervals appear`);
          if (scenario !== 'burndown_early') assert.equal(await chart.locator('[data-value="left"]').innerText(), '8.4–14h', `${label}: elapsed-time forecast`);
          await button.click();
          assert.equal(await chart.locator('[data-label="left"]').innerText(), 'Active time left', `${label}: active estimate label restored`);
          await chart.locator('summary').click();
          assert.equal(await chart.locator('details').evaluate(element => element.open), false, `${label}: burndown collapses`);
          assert((await inspectGeometry()).height <= 440, `${label}: collapsed burndown fits compact view`);
          await chart.locator('summary').click();
        }
        if (process.env.SCREENSHOT_DIR && width === 272) {
          await page.locator('#fixture-host').screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${label}.png`) });
        }
        cases += 1;
      }
    }
    assert.throws(() => render({ ...fixtures.transform, MIGRATION_HOME_URL: 'javascript:alert(1)' }), /HTTPS required/);
    // Exercise the installed host's tooltip implementation, not a fixture imitation.
    const host = fs.readFileSync(path.join(path.dirname(process.env.VISUALIZE_HOST_CSS), 'visualize.html'), 'utf8');
    const scriptUrls = new Set([...host.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]));
    // Each host instance gets a fresh document, pointer, focus, and scroll state.
    for (const theme of ['light', 'dark']) {
      const tooltipPage = await browser.newPage({ viewport: { width: 240, height: 440 } });
      try {
        await tooltipPage.route('**/*', route => scriptUrls.has(route.request().url()) ? route.continue() : route.abort());
        await tooltipPage.emulateMedia({ colorScheme: theme });
        await tooltipPage.setContent(`<style>${css}html>body{padding:0;--font-size-base:14px}</style>${host.replace('<!--__INLINE_VISUALIZATION_FRAGMENT__-->', render(fixtures.target))}`);
        await tooltipPage.waitForFunction(() => window.FloatingUIDOM != null);
        for (let n = 0; n < steps.length; n++) {
          await tooltipPage.locator('.cpv-segment').nth(n).hover();
          await tooltipPage.waitForFunction(expected => document.querySelector('[role="tooltip"]')?.textContent === expected, fixtures.target[`STEP_${n}_LABEL`]);
          const box = await tooltipPage.getByRole('tooltip').boundingBox();
          assert(box && box.x >= 0 && box.x + box.width <= 240, `${theme}: stage ${n} tooltip visible within narrow viewport`);
        }
        await tooltipPage.locator('.cpv-title').hover();
        await tooltipPage.waitForFunction(expected => document.querySelector('[role="tooltip"]')?.textContent === expected, fixtures.target.FRESHNESS);
        const headingTooltip = await tooltipPage.getByRole('tooltip').boundingBox();
        assert(headingTooltip && headingTooltip.x >= 0 && headingTooltip.x + headingTooltip.width <= 240, `${theme}: heading tooltip visible within narrow viewport`);
        await tooltipPage.locator('.cpv-resources summary').click();
        for (const [n, item] of fixtures.target.RESOURCES.entries()) {
          const resource = tooltipPage.locator('.cpv-resources').getByRole('link', { name: item.LABEL, exact: true });
          await resource.hover();
          await tooltipPage.waitForFunction(expected => document.querySelector('[role="tooltip"]')?.textContent === expected, item.RECENCY);
          const resourceTooltip = await tooltipPage.getByRole('tooltip').boundingBox();
          assert(resourceTooltip && resourceTooltip.x >= 0 && resourceTooltip.x + resourceTooltip.width <= 240, `${theme}: resource ${n} recency tooltip within narrow viewport`);
        }
        await tooltipPage.keyboard.press('Escape');
        await tooltipPage.getByRole('tooltip').waitFor({ state: 'hidden' });
      } finally {
        await tooltipPage.close();
      }
    }
    console.log(`Passed ${cases} rendering cases and all ${steps.length} native stage tooltips plus heading freshness and resource recency in light/dark; maximum compact height ${maxCompactHeight}px.`);
  } finally {
    await browser.close();
  }
}
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
