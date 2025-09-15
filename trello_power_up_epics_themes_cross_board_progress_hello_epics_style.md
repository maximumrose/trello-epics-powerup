# Trello Power‑Up: Epics, Themes & Cross‑Board Progress

A production‑ready scaffold for a Trello Power‑Up that provides:

- **Card hierarchy (parent ↔ child)**
- **Themes** (group related cards across boards)
- **Related cards** (quick linking & discovery)
- **Cross‑board progress** (epic completion, per‑theme rollups)

Built with the official **Trello Power‑Up Client Library**, a tiny **Node/Express** backend, and **SQLite** for persistence.

> ⚠️ You must serve the Power‑Up over **HTTPS** (use `ngrok` in dev) and register it in Trello’s Power‑Up admin to enable capabilities.

---

## Project Structure

```
/trello-epics-powerup
├─ server/
│  ├─ index.js
│  ├─ db.js
│  ├─ trello.js
│  ├─ webhook.js
│  └─ .env.example
├─ public/
│  ├─ index.html          # capability bootstrap (client)
│  ├─ styles.css
│  ├─ client.js           # Power‑Up capabilities & UI
│  ├─ dashboard.html      # cross‑board progress UI
│  └─ dashboard.js
├─ powerup.json           # Power‑Up manifest
├─ package.json
└─ README.md
```

---

## powerup.json (manifest)

```json
{
  "$schema": "https://developer.atlassian.com/cloud/trello/power-ups/powerup-schema.json",
  "name": "Epics & Themes (Coach Maximum)",
  "description": "Create epics, group by themes, find related cards, and see progress across boards.",
  "author": "Coach Maximum",
  "capabilities": [
    "board-buttons",
    "card-buttons",
    "card-badges",
    "card-detail-badges",
    "show-authorization",
    "authorization-status",
    "list-actions",
    "attachment-sections",
    "format-url",
    "settings"
  ],
  "connectors": {
    "iframe": {
      "url": "https://YOUR_DOMAIN/index.html"
    }
  },
  "icons": {
    "dark": {
      "icon": "https://YOUR_DOMAIN/icon-dark.svg"
    },
    "light": {
      "icon": "https://YOUR_DOMAIN/icon-light.svg"
    }
  },
  "scopes": ["read", "write"],
  "domains": ["YOUR_DOMAIN"],
  "privacyPolicyUrl": "https://YOUR_DOMAIN/privacy",
  "termsOfUseUrl": "https://YOUR_DOMAIN/terms",
  "defaultLocale": "en"
}
```

> Replace `YOUR_DOMAIN` with your HTTPS dev URL (e.g., ngrok) and later your production host.

---

## public/index.html

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Epics & Themes Power‑Up</title>
  <link rel="stylesheet" href="/styles.css" />
  <script src="https://p.trellocdn.com/power-up.min.js"></script>
  <script defer src="/client.js"></script>
</head>
<body>
  <div id="root">Loading…</div>
</body>
</html>
```

---

## public/styles.css

```css
:root { --fg:#0f172a; --muted:#64748b; --line:#e2e8f0; --accent:#2563eb; }
html,body{margin:0;font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto; color:var(--fg)}
.container{padding:16px; max-width:840px; margin:0 auto}
.row{display:flex; gap:12px; align-items:center}
.btn{background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px 12px;cursor:pointer}
.btn.primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.badge{display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted)}
.kv{display:grid; grid-template-columns:120px 1fr; gap:6px 12px; margin:10px 0}
input, select{padding:8px;border:1px solid var(--line);border-radius:8px;width:100%}
small{color:var(--muted)}
```

---

## public/client.js (Power‑Up capabilities)

```js
/* global TrelloPowerUp */
const Promise = window.TrelloPowerUp.Promise;
const tpu = window.TrelloPowerUp.iframe();

const API_BASE = 'https://YOUR_DOMAIN/api';

async function api(path, method = 'GET', body) {
  const token = await tpu.loadSecret('trelloToken');
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-trello-token': token || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Helpers to read/write data via t.get/t.set so it syncs with cards/boards
const store = {
  getCardData: (t, key) => t.get('card', 'shared', key),
  setCardData: (t, key, val) => t.set('card', 'shared', key, val),
  getBoardData: (t, key) => t.get('board', 'shared', key),
  setBoardData: (t, key, val) => t.set('board', 'shared', key, val),
};

// =============== Capabilities bootstrap ===============
window.TrelloPowerUp.initialize({
  'authorization-status': async (t) => {
    const token = await t.loadSecret('trelloToken');
    return { authorized: Boolean(token) };
  },
  'show-authorization': (t) => {
    return t.popup({
      title: 'Authorize Trello Access',
      url: './index.html#auth',
      height: 200,
    });
  },
  settings: (t) => {
    return t.popup({ title: 'Power‑Up Settings', url: './index.html#settings', height: 320 });
  },
  'board-buttons': (t) => [
    {
      text: 'Themes & Progress',
      icon: { dark: 'https://YOUR_DOMAIN/icon-dark.svg', light: 'https://YOUR_DOMAIN/icon-light.svg' },
      callback: (t) => t.boardBar({ url: './dashboard.html', height: 520, title: 'Themes & Cross‑Board Progress' })
    },
    {
      text: 'Add Theme',
      callback: (t) => t.popup({ title: 'Create Theme', url: './index.html#new-theme', height: 260 })
    }
  ],
  'card-buttons': async (t, opts) => {
    const cardId = opts.card.id;
    const meta = (await store.getCardData(t, 'epicMeta')) || {};
    const hasParent = Boolean(meta.parentId);
    return [
      {
        text: hasParent ? 'Change Parent' : 'Set Parent',
        callback: () => t.popup({ title: 'Select Parent', url: './index.html#select-parent', height: 420 })
      },
      {
        text: 'Add Child',
        callback: () => t.popup({ title: 'Create/Add Child', url: './index.html#add-child', height: 380 })
      },
      {
        text: 'Link Related',
        callback: () => t.popup({ title: 'Link Related Card', url: './index.html#link-related', height: 380 })
      },
      {
        text: 'Set Theme',
        callback: () => t.popup({ title: 'Set Theme', url: './index.html#choose-theme', height: 340 })
      }
    ];
  },
  'card-badges': async (t, opts) => {
    const meta = (await store.getCardData(t, 'epicMeta')) || {};
    const progress = meta.progress || 0;
    const theme = meta.theme || null;
    const badges = [];
    if (theme) badges.push({ text: `Theme: ${theme.name}`, color: 'blue' });
    if (meta.parentId) badges.push({ text: 'child', color: 'purple' });
    if (meta.children && meta.children.length) badges.push({ text: `${progress}%`, color: 'green' });
    return badges;
  },
  'card-detail-badges': async (t, opts) => {
    const meta = (await store.getCardData(t, 'epicMeta')) || {};
    const items = [];
    if (meta.parentId) {
      items.push({
        title: 'Parent',
        text: meta.parentName || meta.parentId,
        callback: () => t.navigate({ url: meta.parentUrl })
      });
    }
    if (meta.children && meta.children.length) {
      items.push({
        title: 'Children',
        text: `${meta.children.length} linked`,
        callback: () => t.popup({ title: 'Children', url: './index.html#list-children', height: 420 })
      });
    }
    if (meta.related && meta.related.length) {
      items.push({
        title: 'Related',
        text: `${meta.related.length} cards`,
        callback: () => t.popup({ title: 'Related Cards', url: './index.html#list-related', height: 420 })
      });
    }
    return items;
  },
  'list-actions': (t, opts) => [{
    text: 'Roll‑up list to Epic',
    callback: () => t.popup({ title: 'Roll‑up', url: './index.html#rollup', height: 260 })
  }],
  'attachment-sections': (t, opts) => {
    const url = opts.entries?.[0]?.url;
    if (!url) return [];
    // If a Trello card URL is attached, show quick link action
    if (/https:\/\/trello.com\/c\//.test(url)) {
      return [{
        claimed: [url],
        icon: 'https://YOUR_DOMAIN/icon-light.svg',
        title: 'Link as Related Card',
        content: {
          type: 'iframe',
          url: t.signUrl('./index.html#claim-related'),
          height: 80
        }
      }];
    }
    return [];
  },
  'format-url': (t, { url }) => {
    // nice label for attached Trello card URLs
    if (/https:\/\/trello.com\/c\//.test(url)) return { icon: 'link', text: 'Trello Card' };
  }
});

// =========== Small router to render popups/boardbars ==========
(async function render() {
  const root = document.getElementById('root');
  const hash = window.location.hash.replace('#', '') || 'home';
  const t = tpu; // alias

  if (hash === 'auth') {
    root.innerHTML = `
      <div class="container">
        <h3>Authorize Trello Access</h3>
        <p><small>We use your token to read across boards you can access.</small></p>
        <button class="btn primary" id="auth">Authorize</button>
      </div>`;
    document.getElementById('auth').onclick = async () => {
      const token = await t.getRestApi().authorize({ scope: 'read,write', expiration: 'never', name: 'Epics & Themes Power‑Up' });
      if (token) {
        await t.storeSecret('trelloToken', token);
        await t.closePopup();
      }
    };
    return;
  }

  if (hash === 'new-theme') {
    root.innerHTML = `
      <div class="container">
        <div class="kv">
          <label>Name</label><input id="name" placeholder="e.g., Onboarding" />
          <label>Description</label><input id="desc" placeholder="Optional" />
        </div>
        <div class="row"><button class="btn primary" id="save">Create Theme</button></div>
      </div>`;
    document.getElementById('save').onclick = async () => {
      const name = document.getElementById('name').value.trim();
      const desc = document.getElementById('desc').value.trim();
      await api('/themes', 'POST', { name, desc });
      t.closePopup();
    };
    return;
  }

  if (hash === 'choose-theme') {
    const themes = await api('/themes');
    root.innerHTML = `<div class="container"><h3>Set Theme</h3><select id="sel"></select><div class="row" style="margin-top:10px"><button class="btn primary" id="apply">Apply</button></div></div>`;
    const sel = document.getElementById('sel');
    themes.forEach(th => sel.insertAdjacentHTML('beforeend', `<option value="${th.id}">${th.name}</option>`));
    document.getElementById('apply').onclick = async () => {
      const themeId = sel.value;
      const card = await t.card('id', 'name', 'url');
      const theme = themes.find(x => x.id == themeId);
      const meta = (await store.getCardData(t, 'epicMeta')) || {};
      meta.theme = { id: theme.id, name: theme.name };
      await store.setCardData(t, 'epicMeta', meta);
      await api(`/themes/${themeId}/cards`, 'POST', { cardId: card.id });
      t.closePopup();
    };
    return;
  }

  if (hash === 'select-parent') {
    // Search own boards for candidate parent cards
    const card = await t.card('id');
    const results = await api(`/search/cards?query=&exclude=${card.id}`);
    root.innerHTML = `<div class="container"><h3>Select Parent</h3><input id="q" placeholder="Search…"/><div id="list"></div></div>`;
    const list = document.getElementById('list');
    function renderList(items){
      list.innerHTML = items.map(c => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>${c.name} <small class="badge">${c.board?.name||''}</small></span><button class="btn" data-id="${c.id}">Set Parent</button></div>`).join('');
      list.querySelectorAll('button').forEach(btn => btn.onclick = async (e) => {
        const parentId = e.currentTarget.getAttribute('data-id');
        const parent = items.find(i => i.id === parentId);
        const meta = (await store.getCardData(t, 'epicMeta')) || {};
        meta.parentId = parent.id; meta.parentName = parent.name; meta.parentUrl = parent.url;
        await store.setCardData(t, 'epicMeta', meta);
        await api(`/hierarchy/${parentId}/children`, 'POST', { childId: card.id });
        await t.closePopup();
      });
    }
    renderList(results.cards);
    document.getElementById('q').oninput = async (e) => {
      const q = e.target.value;
      const r = await api(`/search/cards?query=${encodeURIComponent(q)}`);
      renderList(r.cards);
    };
    return;
  }

  if (hash === 'add-child') {
    const card = await t.card('id', 'name');
    root.innerHTML = `<div class="container"><h3>Add Child</h3><input id="name" placeholder="Child card name"/><div class="row"><button id="create" class="btn primary">Create New</button><button id="link" class="btn">Link Existing…</button></div></div>`;
    document.getElementById('create').onclick = async () => {
      const name = document.getElementById('name').value.trim();
      const created = await api('/cards', 'POST', { name, listHint: 'To Do' });
      const meta = (await store.getCardData(t, 'epicMeta')) || {};
      meta.children = [...(meta.children||[]), { id: created.id, name: created.name, url: created.url }];
      await store.setCardData(t, 'epicMeta', meta);
      await api(`/hierarchy/${card.id}/children`, 'POST', { childId: created.id });
      t.closePopup();
    };
    document.getElementById('link').onclick = () => t.popup({ title: 'Link Existing Card', url: './index.html#select-child', height: 420 });
    return;
  }

  if (hash === 'select-child') {
    const parent = await t.card('id');
    const results = await api(`/search/cards?query=`);
    root.innerHTML = `<div class="container"><h3>Link Existing Card</h3><input id="q" placeholder="Search…"/><div id="list"></div></div>`;
    const list = document.getElementById('list');
    function paint(items){
      list.innerHTML = items.map(c => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>${c.name} <small class="badge">${c.board?.name||''}</small></span><button class="btn" data-id="${c.id}">Link</button></div>`).join('');
      list.querySelectorAll('button').forEach(btn => btn.onclick = async (e) => {
        const childId = e.currentTarget.getAttribute('data-id');
        const meta = (await store.getCardData(t, 'epicMeta')) || {};
        meta.children = [...(meta.children||[]), items.find(i => i.id === childId)];
        await store.setCardData(t, 'epicMeta', meta);
        await api(`/hierarchy/${parent.id}/children`, 'POST', { childId });
        await t.closePopup();
      });
    }
    paint(results.cards);
    document.getElementById('q').oninput = async (e) => {
      const r = await api(`/search/cards?query=${encodeURIComponent(e.target.value)}`);
      paint(r.cards);
    };
    return;
  }

  if (hash === 'link-related') {
    const card = await t.card('id');
    const results = await api(`/search/cards?query=&exclude=${card.id}`);
    root.innerHTML = `<div class="container"><h3>Link Related Card</h3><input id="q" placeholder="Search…"/><div id="list"></div></div>`;
    const list = document.getElementById('list');
    function paint(items){
      list.innerHTML = items.map(c => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>${c.name} <small class="badge">${c.board?.name||''}</small></span><button class="btn" data-id="${c.id}">Link</button></div>`).join('');
      list.querySelectorAll('button').forEach(btn => btn.onclick = async (e) => {
        const relatedId = e.currentTarget.getAttribute('data-id');
        const meta = (await store.getCardData(t, 'epicMeta')) || {};
        meta.related = [...(meta.related||[]), items.find(i => i.id === relatedId)];
        await store.setCardData(t, 'epicMeta', meta);
        await api(`/related/${card.id}`, 'POST', { relatedId });
        await t.closePopup();
      });
    }
    paint(results.cards);
    document.getElementById('q').oninput = async (e) => {
      const r = await api(`/search/cards?query=${encodeURIComponent(e.target.value)}`);
      paint(r.cards);
    };
    return;
  }

  if (hash === 'list-children') {
    const meta = (await store.getCardData(t, 'epicMeta')) || {};
    const kids = meta.children || [];
    root.innerHTML = `<div class="container"><h3>Children</h3>${kids.map(k => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>${k.name}</span><a class="btn" target="_blank" href="${k.url}">Open</a></div>`).join('')}</div>`;
    return;
  }

  if (hash === 'list-related') {
    const meta = (await store.getCardData(t, 'epicMeta')) || {};
    const rel = meta.related || [];
    root.innerHTML = `<div class="container"><h3>Related Cards</h3>${rel.map(k => `<div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:6px 0"><span>${k.name}</span><a class="btn" target="_blank" href="${k.url}">Open</a></div>`).join('')}</div>`;
    return;
  }

  if (hash === 'rollup') {
    const list = await t.list('id', 'name');
    root.innerHTML = `<div class="container"><h3>Roll‑up “${list.name}”</h3><p><small>Set parent for all cards in this list.</small></p><input id="parent" placeholder="Paste parent card URL"/><div class="row"><button id="go" class="btn primary">Apply</button></div></div>`;
    document.getElementById('go').onclick = async () => {
      const url = document.getElementById('parent').value.trim();
      const m = url.match(/trello.com\/c\/([A-Za-z0-9]+)/);
      if (!m) return t.alert({ message: 'Invalid card URL' });
      const parentCard = await api(`/cards/byshort/${m[1]}`);
      const cards = await t.cards('id');
      for (const c of cards) {
        await api(`/hierarchy/${parentCard.id}/children`, 'POST', { childId: c.id });
      }
      t.closePopup();
    };
    return;
  }

  // default root UI (simple help)
  root.innerHTML = `<div class="container">
    <h3>Epics & Themes Power‑Up</h3>
    <p class="badge">Use card buttons to set parent/child, link related, and set themes.</p>
  </div>`;
})();
```

---

## public/dashboard.html (Cross‑board progress)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="/styles.css" />
</head>
<body>
  <div class="container">
    <h3>Themes & Cross‑Board Progress</h3>
    <div id="themes"></div>
  </div>
  <script src="https://p.trellocdn.com/power-up.min.js"></script>
  <script src="/dashboard.js"></script>
</body>
</html>
```

---

## public/dashboard.js

```js
/* global TrelloPowerUp */
const t = window.TrelloPowerUp.iframe();
const API_BASE = 'https://YOUR_DOMAIN/api';

async function api(path) {
  const token = await t.loadSecret('trelloToken');
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'x-trello-token': token || '' } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

(async function init(){
  const container = document.getElementById('themes');
  const data = await api('/progress');
  container.innerHTML = data.themes.map(th => `
    <div style="border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0">
      <div class="row" style="justify-content:space-between">
        <strong>${th.name}</strong>
        <span class="badge">${th.progress.completed}/${th.progress.total} done (${Math.round(th.progress.pct)}%)</span>
      </div>
      <div style="height:10px;background:#f1f5f9;border-radius:8px;margin-top:8px;position:relative">
        <div style="position:absolute;left:0;top:0;bottom:0;width:${th.progress.pct}%;background:#22c55e;border-radius:8px"></div>
      </div>
      <small>Boards: ${th.boards.map(b=>b.name).join(', ')}</small>
    </div>`).join('');
})();
```

---

## server/.env.example

```
PORT=8080
BASE_URL=https://YOUR_DOMAIN
TRELLO_API_KEY=YOUR_TRELLO_API_KEY
# optional: create a user token for server‑side calls if needed
TRELLO_TOKEN=YOUR_TRELLO_TOKEN
SQLITE_PATH=./data.db
WEBHOOK_SECRET=random_shared_secret
```

---

## server/db.js (SQLite schema & helpers)

```js
import Database from 'better-sqlite3';
const db = new Database(process.env.SQLITE_PATH || './data.db');

db.exec(`
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  desc TEXT
);
CREATE TABLE IF NOT EXISTS theme_cards (
  theme_id INTEGER NOT NULL,
  card_id TEXT NOT NULL,
  card_name TEXT,
  card_url TEXT,
  board_id TEXT,
  board_name TEXT,
  UNIQUE(theme_id, card_id)
);
CREATE TABLE IF NOT EXISTS hierarchy (
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  UNIQUE(parent_id, child_id)
);
CREATE TABLE IF NOT EXISTS related (
  a_id TEXT NOT NULL,
  b_id TEXT NOT NULL,
  UNIQUE(a_id, b_id)
);
`);

export default db;
```

---

## server/trello.js (Trello REST helpers)

```js
import fetch from 'node-fetch';

const key = process.env.TRELLO_API_KEY;
const serverToken = process.env.TRELLO_TOKEN;
const BASE = 'https://api.trello.com/1';

function qs(params){
  return new URLSearchParams(params);
}

export async function trello(path, { method = 'GET', token, body } = {}){
  const url = `${BASE}${path}?${qs({ key, token: token || serverToken })}`;
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function searchCards({ query, token }){
  // Trello search API scopes across boards the token can see
  const res = await trello('/search', { token, method: 'GET' });
  const url = `${BASE}/search?${qs({ key, token, query: query || '', modelTypes: 'cards', card_fields: 'name,url,idBoard', cards_limit: 50 })}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
```

---

## server/webhook.js (optional: keep progress fresh)

```js
import crypto from 'crypto';

export function verify(req, res, next){
  const secret = process.env.WEBHOOK_SECRET;
  const sig = req.headers['x-trello-webhook'];
  if (!secret || !sig) return next();
  const hmac = crypto.createHmac('sha1', secret).update(JSON.stringify(req.body)).digest('base64');
  if (hmac !== sig) return res.status(401).send('bad sig');
  next();
}
```

---

## server/index.js (Express API)

```js
import express from 'express';
import cors from 'cors';
import db from './db.js';
import { trello, searchCards } from './trello.js';
import { verify as verifyWebhook } from './webhook.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function requireToken(req, res, next){
  const token = req.headers['x-trello-token'];
  if (!token) return res.status(401).send('Missing x-trello-token');
  req.token = token; next();
}

// --- Themes ---
app.get('/api/themes', (req,res)=>{
  const rows = db.prepare('SELECT * FROM themes ORDER BY id DESC').all();
  res.json(rows);
});
app.post('/api/themes', (req,res)=>{
  const { name, desc } = req.body;
  const info = db.prepare('INSERT INTO themes (name, desc) VALUES (?, ?)').run(name, desc||null);
  res.json({ id: info.lastInsertRowid, name, desc });
});
app.post('/api/themes/:id/cards', requireToken, async (req,res)=>{
  const themeId = Number(req.params.id);
  const { cardId } = req.body;
  const card = await trello(`/cards/${cardId}`, { token: req.token });
  db.prepare('INSERT OR IGNORE INTO theme_cards (theme_id, card_id, card_name, card_url, board_id, board_name) VALUES (?,?,?,?,?,?)')
    .run(themeId, card.id, card.name, card.url, card.idBoard, (await trello(`/boards/${card.idBoard}`, { token: req.token })).name);
  res.json({ ok: true });
});

// --- Hierarchy ---
app.post('/api/hierarchy/:parentId/children', requireToken, async (req,res)=>{
  const { parentId } = req.params; const { childId } = req.body;
  db.prepare('INSERT OR IGNORE INTO hierarchy (parent_id, child_id) VALUES (?,?)').run(parentId, childId);
  res.json({ ok: true });
});

// --- Related ---
app.post('/api/related/:aId', requireToken, (req,res)=>{
  const { aId } = req.params; const { relatedId } = req.body;
  const [a,b] = aId < relatedId ? [aId, relatedId] : [relatedId, aId];
  db.prepare('INSERT OR IGNORE INTO related (a_id, b_id) VALUES (?,?)').run(a,b);
  res.json({ ok: true });
});

// --- Cards ---
app.post('/api/cards', requireToken, async (req,res)=>{
  const { name, listHint } = req.body;
  // create card in the first matching list named listHint or the first list on the current board (fallback: user will move it)
  // For simplicity, create on the most recent board user visited is out of scope; use a default board via env or instruct linking existing cards.
  // In practice, you can pass boardId & listId from the client using t.board() & t.list().
  res.status(501).send('Implement create to a chosen board/list by passing boardId/listId from client.');
});

app.get('/api/cards/byshort/:shortId', requireToken, async (req,res)=>{
  const r = await trello(`/cards/${req.params.shortId}`, { token: req.token });
  res.json(r);
});

// --- Search ---
app.get('/api/search/cards', requireToken, async (req,res)=>{
  const q = (req.query.query||'').trim();
  const exclude = req.query.exclude;
  const r = await searchCards({ query: q, token: req.token });
  const cards = (r.cards||[]).filter(c => c.id !== exclude).map(c => ({ id:c.id, name:c.name, url:c.url, board:{ id:c.idBoard } }));
  // hydrate board names (basic cache omitted for brevity)
  const seen = new Map();
  for (const c of cards){
    if (!seen.has(c.board.id)){
      const b = await trello(`/boards/${c.board.id}`, { token: req.token });
      seen.set(c.board.id, b.name);
    }
    c.board.name = seen.get(c.board.id);
  }
  res.json({ cards });
});

// --- Progress Rollup ---
app.get('/api/progress', requireToken, async (req,res)=>{
  // compute theme completion as #children done / total, where "done" inferred from card closed or in a Done list
  const themes = db.prepare('SELECT * FROM themes').all();
  const out = [];
  for (const th of themes){
    const rows = db.prepare('SELECT * FROM theme_cards WHERE theme_id = ?').all(th.id);
    let total = rows.length, completed = 0;
    const boards = new Map();
    for (const row of rows){
      const card = await trello(`/cards/${row.card_id}`, { token: req.token });
      const isDone = card.closed || /done|complete/i.test(card.idList ? (await trello(`/lists/${card.idList}`, { token: req.token })).name : '');
      if (isDone) completed++;
      boards.set(row.board_id, row.board_name);
    }
    out.push({ id: th.id, name: th.name, progress: { total, completed, pct: total ? (completed/total*100) : 0 }, boards: [...boards.entries()].map(([id,name])=>({id,name})) });
  }
  res.json({ themes: out });
});

// --- Webhooks (optional – register per board/card) ---
app.post('/api/webhook', verifyWebhook, (req,res)=>{
  // handle Trello webhook callbacks to update cached names/boards, etc.
  res.sendStatus(200);
});

const port = process.env.PORT || 8080;
app.listen(port, ()=> console.log(`Power‑Up running on :${port}`));
```

---

## package.json

```json
{
  "name": "trello-epics-powerup",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node server/index.js",
    "db:reset": "rm -f data.db && node -e \"require('fs').writeFileSync('data.db','')\""
  },
  "dependencies": {
    "better-sqlite3": "^9.4.5",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "node-fetch": "^3.3.2"
  }
}
```

---

## README.md (quick start)

````md
# Epics & Themes Power‑Up

## 1) Install deps

```bash
npm i
````

## 2) Run locally (HTTPS via ngrok)

```bash
export PORT=8080
node server/index.js
# in another shell: ngrok http 8080
```

Update `powerup.json` `YOUR_DOMAIN` with the ngrok https URL.

## 3) Register the Power‑Up

- Go to Trello Power‑Up admin and create a new Power‑Up.
- Provide the public URLs for `index.html` and icons.
- Add capabilities listed in the manifest.

## 4) Authorize

- Click a board’s **Power‑Ups → Add Power‑Ups → Your Power‑Ups**.
- Open the **board button → Themes & Progress**; authorize when prompted.

## 5) Use it

- On any card: **Set Parent**, **Add Child**, **Link Related**, **Set Theme**.
- Open **Themes & Progress** to see cross‑board rollups.

## Notes

- For creating new child cards, pass `boardId`/`listId` from the client (we left a TODO in `/api/cards`).
- Persistence uses SQLite; migrate to Postgres for multi‑user scale.
- Add Trello webhooks per board to keep names/status fresh without polling.

```

---

## Implementation Notes & Extensibility

- Uses Trello **t.get/t.set** for lightweight per‑card metadata and a server for cross‑board search & rollups.
- Themes are global in this simple build; scope per workspace or per board by adding columns.
- Progress detects **Done** by card closed or list name regex; adapt to your workflow (e.g., label = Done).
- Add an **Attachment Section** to claim attached Trello card URLs as related.
- Add **format-url** for cleaner labels on attached Trello links.
- Implement **authorization** with `t.getRestApi().authorize()` (stored via `t.storeSecret`).
- For production: add rate‑limit, caching, background workers (webhooks → queue), and RBAC.

---

## Security Checklist

- Only accept calls with a valid `x-trello-token` that belongs to the current user.
- Serve over HTTPS.
- Validate card IDs and restrict writes to cards/boards the token can access.
- Rotate `WEBHOOK_SECRET` and verify signatures.

---

Happy building! 🚀

```
