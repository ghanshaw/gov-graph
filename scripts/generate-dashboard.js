import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const featuresDir = path.join(__dirname, '..', 'features');

function extractSection(lines, heading) {
  const start = lines.findIndex(l => l.trim() === `## ${heading}`);
  if (start === -1) return [];
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

function parseFeature(content, name) {
  const lines = content.split('\n');

  const titleLine = lines.find(l => l.startsWith('# '));
  const title = titleLine ? titleLine.slice(2).trim() : name;

  let status = 'Not Started';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '## Status') {
      const next = lines.slice(i + 1).find(l => l.trim() !== '');
      if (next) status = next.trim();
      break;
    }
  }

  const goalLines = extractSection(lines, 'Goal');
  const goal = goalLines.filter(l => l.trim()).join(' ').trim();

  const doneItems = extractSection(lines, 'Done')
    .filter(l => /^- \[x\]/i.test(l.trim()))
    .map(l => l.replace(/^- \[x\]\s*/i, '').trim());

  const todoItems = extractSection(lines, 'Todo')
    .filter(l => /^- \[ \]/.test(l.trim()))
    .map(l => l.replace(/^- \[ \]\s*/, '').trim());

  const notesLines = extractSection(lines, 'Decisions / Notes')
    .filter(l => l.trim() && l.trim().startsWith('-'))
    .map(l => l.replace(/^-\s*/, '').trim());

  const done = doneItems.length;
  const todo = todoItems.length;
  const total = done + todo;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return { title, status, done, todo, total, pct, goal, doneItems, todoItems, notesLines };
}

function statusClass(status) {
  const s = status.toLowerCase();
  if (s === 'complete' || s === 'completed') return 'complete';
  if (s.includes('progress')) return 'in-progress';
  if (s === 'blocked') return 'blocked';
  return 'not-started';
}

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCard(feature, idx) {
  const { title, status, done, todo, total, pct } = feature;
  const cls = statusClass(status);
  const countText = total === 0 ? 'No tasks yet' : `${done} done · ${todo} remaining`;

  return `
    <div class="card" onclick="openDetail(${idx})" role="button" tabindex="0" onkeydown="if(event.key==='Enter')openDetail(${idx})">
      <div class="card-header">
        <h2>${esc(title)}</h2>
        <span class="badge ${cls}">${esc(status)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill ${cls}" style="width: ${pct}%"></div>
      </div>
      <p class="counts">${countText}</p>
    </div>`;
}

function renderDetailData(features) {
  return `const FEATURES = ${JSON.stringify(features.map(f => ({
    title: f.title,
    status: f.status,
    goal: f.goal,
    doneItems: f.doneItems,
    todoItems: f.todoItems,
    notesLines: f.notesLines,
    done: f.done,
    todo: f.todo,
    total: f.total,
    pct: f.pct,
  })))};`;
}

function generateHTML(features) {
  const cards = features.map((f, i) => renderCard(f, i));
  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>govgraph · features</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f1117;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      padding: 2rem;
    }

    header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #2a2d3a;
    }

    header h1 { font-size: 1rem; font-weight: 500; color: #8892a4; letter-spacing: 0.05em; }
    header h1 span { color: #e2e8f0; }
    header time { font-size: 0.75rem; color: #8892a4; }

    main {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .card {
      background: #1a1d27;
      border: 1px solid #2a2d3a;
      border-radius: 8px;
      padding: 1.25rem;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .card:hover { border-color: #4f8ef7; background: #1e2235; }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .card-header h2 { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; line-height: 1.3; }

    .badge {
      flex-shrink: 0;
      font-size: 0.7rem;
      font-weight: 500;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      text-transform: capitalize;
      white-space: nowrap;
    }
    .badge.complete    { background: #14532d; color: #86efac; }
    .badge.in-progress { background: #1e3a5f; color: #93c5fd; }
    .badge.blocked     { background: #450a0a; color: #fca5a5; }
    .badge.not-started { background: #1e2130; color: #8892a4; }

    .progress-track {
      height: 6px;
      background: #2a2d3a;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 0.6rem;
    }
    .progress-fill { height: 100%; border-radius: 3px; }
    .progress-fill.complete    { background: #22c55e; }
    .progress-fill.in-progress { background: #4f8ef7; }
    .progress-fill.blocked     { background: #ef4444; }
    .progress-fill.not-started { background: #8892a4; }

    .counts { font-size: 0.75rem; color: #8892a4; }

    .empty {
      grid-column: 1 / -1;
      text-align: center;
      color: #8892a4;
      padding: 3rem;
      font-size: 0.9rem;
    }

    /* Detail panel */
    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 10;
      align-items: flex-start;
      justify-content: center;
      padding: 2rem 1rem;
      overflow-y: auto;
    }
    .overlay.open { display: flex; }

    .detail {
      background: #1a1d27;
      border: 1px solid #2a2d3a;
      border-radius: 10px;
      width: 100%;
      max-width: 680px;
      padding: 2rem;
      position: relative;
    }

    .detail-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: none;
      border: none;
      color: #8892a4;
      font-size: 1.2rem;
      cursor: pointer;
      line-height: 1;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    .detail-close:hover { color: #e2e8f0; background: #2a2d3a; }

    .detail-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .detail-title h2 { font-size: 1.2rem; font-weight: 700; }

    .detail-progress {
      margin-bottom: 1.5rem;
    }
    .detail-progress .progress-track { height: 8px; margin-bottom: 0.4rem; }
    .detail-progress .counts { font-size: 0.8rem; }

    .detail-section { margin-bottom: 1.5rem; }
    .detail-section h3 {
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8892a4;
      margin-bottom: 0.6rem;
    }
    .detail-section p {
      font-size: 0.9rem;
      line-height: 1.6;
      color: #c8d0dc;
    }

    .task-list { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; }
    .task-list li {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      font-size: 0.875rem;
      line-height: 1.5;
      color: #c8d0dc;
    }
    .task-list li .check {
      flex-shrink: 0;
      width: 1rem;
      height: 1rem;
      margin-top: 0.15rem;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
    }
    .task-list li.done .check { background: #14532d; color: #86efac; }
    .task-list li.todo .check { border: 1.5px solid #2a2d3a; }
    .task-list li.done { color: #8892a4; text-decoration: line-through; text-decoration-color: #4a5568; }

    .notes-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
    .notes-list li {
      font-size: 0.85rem;
      line-height: 1.5;
      color: #8892a4;
      padding-left: 1rem;
      position: relative;
    }
    .notes-list li::before {
      content: '—';
      position: absolute;
      left: 0;
      color: #4a5568;
    }

    .empty-state { font-size: 0.85rem; color: #4a5568; font-style: italic; }
  </style>
</head>
<body>
  <header>
    <h1>govgraph / <span>features</span></h1>
    <time>${now}</time>
  </header>
  <main>
    ${cards.length === 0
      ? '<p class="empty">No feature files found. Create features/&lt;name&gt;/index.md to get started.</p>'
      : cards.join('\n')}
  </main>

  <div class="overlay" id="overlay" onclick="handleOverlayClick(event)">
    <div class="detail" id="detail">
      <button class="detail-close" onclick="closeDetail()">✕</button>
      <div class="detail-title">
        <h2 id="d-title"></h2>
        <span class="badge" id="d-badge"></span>
      </div>
      <div class="detail-progress">
        <div class="progress-track">
          <div class="progress-fill" id="d-bar"></div>
        </div>
        <p class="counts" id="d-counts"></p>
      </div>
      <div class="detail-section" id="d-goal-section">
        <h3>Goal</h3>
        <p id="d-goal"></p>
      </div>
      <div class="detail-section">
        <h3>Steps Completed</h3>
        <ul class="task-list" id="d-done"></ul>
      </div>
      <div class="detail-section">
        <h3>Steps Remaining</h3>
        <ul class="task-list" id="d-todo"></ul>
      </div>
      <div class="detail-section" id="d-notes-section">
        <h3>Decisions &amp; Notes</h3>
        <ul class="notes-list" id="d-notes"></ul>
      </div>
    </div>
  </div>

  <script>
    ${renderDetailData(features)}

    function statusClass(s) {
      s = s.toLowerCase();
      if (s === 'complete' || s === 'completed') return 'complete';
      if (s.includes('progress')) return 'in-progress';
      if (s === 'blocked') return 'blocked';
      return 'not-started';
    }

    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function openDetail(idx) {
      const f = FEATURES[idx];
      const cls = statusClass(f.status);

      document.getElementById('d-title').textContent = f.title;

      const badge = document.getElementById('d-badge');
      badge.textContent = f.status;
      badge.className = 'badge ' + cls;

      const bar = document.getElementById('d-bar');
      bar.style.width = f.pct + '%';
      bar.className = 'progress-fill ' + cls;

      const total = f.total;
      document.getElementById('d-counts').textContent =
        total === 0 ? 'No tasks yet' : f.done + ' done · ' + f.todo + ' remaining';

      const goalEl = document.getElementById('d-goal');
      goalEl.textContent = f.goal || '';
      document.getElementById('d-goal-section').style.display = f.goal ? '' : 'none';

      const doneEl = document.getElementById('d-done');
      doneEl.innerHTML = f.doneItems.length
        ? f.doneItems.map(t => '<li class="done"><span class="check">✓</span><span>' + esc(t) + '</span></li>').join('')
        : '<li><span class="empty-state">Nothing completed yet</span></li>';

      const todoEl = document.getElementById('d-todo');
      todoEl.innerHTML = f.todoItems.length
        ? f.todoItems.map(t => '<li class="todo"><span class="check"></span><span>' + esc(t) + '</span></li>').join('')
        : '<li><span class="empty-state">No remaining steps</span></li>';

      const notesEl = document.getElementById('d-notes');
      notesEl.innerHTML = f.notesLines.length
        ? f.notesLines.map(n => '<li>' + esc(n) + '</li>').join('')
        : '';
      document.getElementById('d-notes-section').style.display = f.notesLines.length ? '' : 'none';

      document.getElementById('overlay').classList.add('open');
    }

    function closeDetail() {
      document.getElementById('overlay').classList.remove('open');
    }

    function handleOverlayClick(e) {
      if (e.target === document.getElementById('overlay')) closeDetail();
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });
  </script>
</body>
</html>`;
}

const entries = fs.readdirSync(featuresDir, { withFileTypes: true })
  .filter(e => e.isDirectory());

const features = [];
for (const entry of entries) {
  const indexPath = path.join(featuresDir, entry.name, 'index.md');
  if (!fs.existsSync(indexPath)) continue;
  const content = fs.readFileSync(indexPath, 'utf8');
  features.push(parseFeature(content, entry.name));
}

const html = generateHTML(features);
fs.writeFileSync(path.join(featuresDir, 'dashboard.html'), html);
console.log(`Generated features/dashboard.html (${features.length} feature${features.length !== 1 ? 's' : ''})`);
