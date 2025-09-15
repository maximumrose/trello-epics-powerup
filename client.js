
/* global TrelloPowerUp */
const Promise = window.TrelloPowerUp.Promise;
const tpu = window.TrelloPowerUp.iframe();

const API_BASE = 'https://trello-epics-powerup.onrender.com/api';

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
      icon: { dark: 'https://trello-epics-powerup.onrender.com/icon-dark.svg', light: 'https://trello-epics-powerup.onrender.com/icon-light.svg' },
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
        icon: 'https://trello-epics-powerup.onrender.com/icon-light.svg',
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