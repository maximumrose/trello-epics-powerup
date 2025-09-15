/* global TrelloPowerUp */
const t = window.TrelloPowerUp.iframe();
const API_BASE = 'https://trello-epics-powerup.onrender.com/api';

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