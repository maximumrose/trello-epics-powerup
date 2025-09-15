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