/* global TrelloPowerUp */
const t = window.TrelloPowerUp.iframe();
console.log('[PU] ui iframe loaded, hash=', window.location.hash);

// your previous router & handlers (auth, new-theme, select-parent, add-child, etc.)
// NOTE: replace references from "tpu" to "t" if you had that earlier