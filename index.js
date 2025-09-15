import express from 'express';
import cors from 'cors';
import db from './db.js';
import { trello, searchCards } from './trello.js';
import { verify as verifyWebhook } from './webhook.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  // allow Trello to iframe this page
  res.removeHeader('X-Frame-Options');                // in case something sets it
  res.setHeader('X-Frame-Options', 'ALLOWALL');       // dev-friendly; okay for your personal use

  // Content Security Policy: allow Trello SDK and being framed by trello.com
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self' https://p.trellocdn.com https://api.trello.com https://*.trello.com",
      "script-src 'self' https://p.trellocdn.com 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src * data: blob:",
      "connect-src 'self' https://api.trello.com https://*.trello.com",
      "frame-ancestors https://*.trello.com"
    ].join('; ')
  );

  next();
});
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