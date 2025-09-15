/* global TrelloPowerUp */
console.log('[PU] connector.js loaded');

window.TrelloPowerUp.initialize({
  'board-buttons': (t) => [{
    text: 'Hello',
    callback: () => t.alert({ message: 'Power-Up is alive!' })
  }],

  // keep these stubs so Trello stops warning; we’ll wire auth later
  'authorization-status': async (t) => {
    const token = await t.loadSecret('trelloToken');
    return { authorized: Boolean(token) };
  },
  'show-authorization': (t) => t.popup({ title: 'Authorize', url: '/ui.html#auth', height: 200 }),
});
