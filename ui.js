/* global TrelloPowerUp */
const t = window.TrelloPowerUp.iframe();
const root = document.getElementById('root');

function render(html) {
  root.innerHTML = html;
}

function on(id, evt, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, fn);
}

// --- Simple router ---
async function route() {
  const hash = (window.location.hash || '').replace('#', '');

  // 1) Authorization popup
  if (hash === 'auth') {
    render(`
      <div class="container">
        <h3>Authorize Trello Access</h3>
        <p><small>We’ll store a user token so the Power-Up can search across your boards.</small></p>
        <button class="btn primary" id="auth">Authorize</button>
      </div>
    `);

    on('auth', 'click', async () => {
      try {
        const token = await t.getRestApi().authorize({
          scope: 'read,write',
          expiration: 'never',
          name: 'Epics & Themes Power-Up'
        });
        if (token) {
          await t.storeSecret('trelloToken', token);
          await t.alert({ message: 'Authorized!' });
          await t.closePopup();
        } else {
          await t.alert({ message: 'Authorization was cancelled.' });
        }
      } catch (e) {
        console.error('Auth error:', e);
        await t.alert({ message: 'Authorization failed. Check console.' });
      }
    });
    return;
  }

  // 2) Create Theme popup (visual sanity check)
  if (hash === 'new-theme') {
    render(`
      <div class="container">
        <h3>Create Theme</h3>
        <div class="kv">
          <label>Name</label>
          <input id="thName" placeholder="e.g., Onboarding" />
          <label>Description</label>
          <input id="thDesc" placeholder="Optional" />
        </div>
        <div class="row">
          <button class="btn primary" id="saveTheme">Save</button>
          <button class="btn" id="cancel">Cancel</button>
        </div>
        <small>This is a demo UI to verify the popup renders and events fire.</small>
      </div>
    `);

    on('saveTheme', 'click', async () => {
      const name = (document.getElementById('thName').value || '').trim();
      if (!name) {
        return t.alert({ message: 'Please enter a theme name.' });
      }
      // For now, just prove it works. Later, call your backend: POST /api/themes
      console.log('[PU] Save theme clicked:', name);
      await t.alert({ message: `Theme “${name}” captured (demo).` });
      await t.closePopup();
    });

    on('cancel', 'click', () => t.closePopup());
    return;
  }

  // 3) (Optional) Dashboard board-bar – visible when board button opens it
  if (hash === 'dashboard') {
    render(`
      <div class="container">
        <h3>Themes & Cross-Board Progress</h3>
        <p><small>Minimal stub – if you can see this in a board bar, the UI is wiring correctly.</small></p>
      </div>
    `);
    return;
  }

  // Default: simple hello (if someone opens /ui.html directly)
  render(`
    <div class="container">
      <h3>Epics & Themes UI</h3>
      <p class="badge">UI iframe loaded. Hash: <code>#${hash || ''}</code></p>
      <p><small>Open from Trello via a popup or board bar to see actual feature panes.</small></p>
    </div>
  `);
}

window.addEventListener('hashchange', route);
route();
