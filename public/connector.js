/* global TrelloPowerUp */
// Register capabilities here — NO TrelloPowerUp.iframe() on this page
window.TrelloPowerUp.initialize({
  'authorization-status': async (t) => {
    const token = await t.loadSecret('trelloToken');
    return { authorized: Boolean(token) };
  },
  'show-authorization': (t) => t.popup({
    title: 'Authorize Trello Access',
    url: '/ui.html#auth',
    height: 200,
  }),
  'settings': (t) => t.popup({ title: 'Power-Up Settings', url: '/ui.html#settings', height: 320 }),
  'board-buttons': (t) => [{
    text: 'Themes & Progress',
    icon: {
      dark: 'https://trello-epics-powerup.onrender.com/icon-light.svg',
      light: 'https://trello-epics-powerup.onrender.com/icon-dark.svg'
    },
    callback: () => t.boardBar({ url: '/ui.html#dashboard', height: 520, title: 'Themes & Cross-Board Progress' })
  },{
    text: 'Add Theme',
    callback: () => t.popup({ title: 'Create Theme', url: '/ui.html#new-theme', height: 260 })
  }],
  'card-buttons': (t) => [{
    text: 'Set Parent',
    callback: () => t.popup({ title: 'Select Parent', url: '/ui.html#select-parent', height: 420 })
  },{
    text: 'Add Child',
    callback: () => t.popup({ title: 'Create/Add Child', url: '/ui.html#add-child', height: 380 })
  },{
    text: 'Link Related',
    callback: () => t.popup({ title: 'Link Related Card', url: '/ui.html#link-related', height: 380 })
  },{
    text: 'Set Theme',
    callback: () => t.popup({ title: 'Set Theme', url: '/ui.html#choose-theme', height: 340 })
  }],
  'card-badges': async (t) => { /* ... as before ... */ },
  'card-detail-badges': async (t) => { /* ... as before ... */ },
  'list-actions': (t) => [{ text: 'Roll-up list to Epic', callback: () => t.popup({ title: 'Roll-up', url: '/ui.html#rollup', height: 260 }) }],
  'attachment-sections': (t, opts) => {
    const url = opts.entries?.[0]?.url;
    if (!url) return [];
    if (/https:\/\/trello\.com\/c\//.test(url)) {
      return [{
        claimed: [url],
        icon: 'https://trello-epics-powerup.onrender.com/icon-light.svg',
        title: 'Link as Related Card',
        content: {
          type: 'iframe',
          // MUST sign iframe URLs here:
          url: t.signUrl('/ui.html#claim-related'),
          height: 80
        }
      }];
    }
    return [];
  },
  'format-url': (t, { url }) => (/https:\/\/trello\.com\/c\//.test(url) ? { icon: 'link', text: 'Trello Card' } : undefined),
});
