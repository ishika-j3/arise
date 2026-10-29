'use strict';
/* Optional account: email and password, with end-to-end encrypted sync. Free, no Google, no emails sent.
   How privacy works (same design as Inner Citadel, and the same login works for both):
   - The password never leaves the phone as-is. Two keys are made from it on the phone:
     one to log in to Supabase, one to encrypt the save (AES-GCM, 256-bit).
   - Supabase stores only the encrypted blob, one row per player under row-level security.
     Nobody with database access can read it, including whoever runs the project.
   - A forgotten password means the synced copy can't be unlocked. The backup file still works.
   Runs after app.js and uses its globals: st, priv, save, render, sys, esc, el, val, openSheet, closeSheet,
   sheetSettings, freshState, freshPriv, KEY, PKEY, ACT. */
const SB_URL = 'https://biskpdjpgmcsmlvakozc.supabase.co';
const SB_KEY = 'sb_publishable_cpTyNtVTx1zmvUrSLTo_vA_mabUjJKn';   // a public key by design; row-level security does the protecting
const SESSION_KEY = 'arise-session', OWNER_KEY = 'arise-owner', KEYDB = 'arise-keys';
const DEVICE_ONLY = ['preview', 'dateOverride', 'sound'];        // settings that belong to this phone, not the account
const acct = { session: null, key: null, salt: null, status: 'off', last: 0, busy: false, pushing: false, again: false, pulled: false };

const te = new TextEncoder(), td = new TextDecoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} }, del: k => { try { localStorage.removeItem(k); } catch (e) {} } };
function idb(mode, fn) {
  return new Promise(res => {
    try {
      const o = indexedDB.open(KEYDB, 1);
      o.onupgradeneeded = () => o.result.createObjectStore('k');
      o.onerror = () => res(null);
      o.onsuccess = () => { const tx = o.result.transaction('k', mode), r = fn(tx.objectStore('k')); tx.oncomplete = () => res(r ? r.result : null); tx.onerror = () => res(null); };
    } catch (e) { res(null); }
  });
}
const keyStore = { get: () => idb('readonly', s => s.get('main')), put: v => idb('readwrite', s => s.put(v, 'main')), clear: () => idb('readwrite', s => s.clear()) };

/* ---------- Crypto ---------- */
async function loginSecret(email, password) {
  // What Supabase sees instead of the real password. Same recipe as Inner Citadel, so one account works for both.
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: te.encode('inner-citadel-login:' + email.toLowerCase()), iterations: 150000, hash: 'SHA-256' }, base, 256));
}
async function vaultKey(password, salt) {
  const base = await crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function seal(obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return { iv: b64(iv), data: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, acct.key, te.encode(JSON.stringify(obj)))) };
}
async function unseal(s) { return JSON.parse(td.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, acct.key, unb64(s.data)))); }

/* ---------- Supabase over plain REST ---------- */
async function authCall(path, body, token) {
  const r = await fetch(SB_URL + '/auth/v1/' + path, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_KEY, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}
function keepSession(d) {
  const s = acct.session;
  acct.session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at ? d.expires_at * 1000 : Date.now() + (d.expires_in || 3600) * 1000,
    user_id: d.user && d.user.id ? d.user.id : s && s.user_id, email: d.user && d.user.email ? d.user.email : s && s.email };
  ls.set(SESSION_KEY, JSON.stringify(acct.session));
}
async function token() {
  const s = acct.session; if (!s) throw new Error('signed-out');
  if (Date.now() < s.expires_at - 60000) return s.access_token;
  const r = await authCall('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
  if (!r.ok) throw new Error('signed-out');
  keepSession(r.data); return acct.session.access_token;
}
async function rest(method, query, body, extra) {
  const r = await fetch(SB_URL + '/rest/v1/arise_saves' + (query || ''), { method, headers: { apikey: SB_KEY, authorization: 'Bearer ' + await token(), 'content-type': 'application/json', ...(extra || {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('rest-' + r.status);
  return r.status === 204 || r.status === 201 ? null : r.json().catch(() => null);
}

/* ---------- Sync ---------- */
function privForSync() { const p = Object.assign({}, priv); DEVICE_ONLY.forEach(k => delete p[k]); return p; }
function setStatus(s) { acct.status = s; if (s === 'ok') acct.last = Date.now(); acctRefresh(); }
async function acctPush() {
  // Never upload before this session has pulled the account copy: a stale phone must not overwrite a newer one.
  if (!acct.session || !acct.key || !acct.pulled) return;
  if (acct.pushing) { acct.again = true; return; }
  acct.pushing = true; acct.again = false; setStatus('syncing');
  try {
    const box = await seal({ st, priv: privForSync() });
    await rest('POST', '', { user_id: acct.session.user_id, state: { v: 1, salt: b64(acct.salt), iv: box.iv, data: box.data }, updated_at: st.updatedAt || new Date().toISOString() },
      { prefer: 'resolution=merge-duplicates,return=minimal' });
    setStatus('ok');
  } catch (e) { setStatus(String(e.message) === 'signed-out' ? 'signedout' : 'offline'); }
  acct.pushing = false; if (acct.again) acctPush();
}
let pushTimer = null;
function acctQueue() { if (!acct.session || !acct.key) return; clearTimeout(pushTimer); pushTimer = setTimeout(acctPush, 2500); }
// Coming back to the app or back online: pull first, then push only if this phone is newer.
async function resync() { if (!acct.session || !acct.key) return; try { await openVault(null); } catch (e) { setStatus(String(e && e.message) === 'signed-out' ? 'signedout' : 'offline'); } }
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (pushTimer && acct.pulled) { clearTimeout(pushTimer); acctPush(); } }
  else resync();
});
window.addEventListener('online', resync);

function forgetLogin() {
  clearTimeout(pushTimer);
  // end the session on the server too, so a copied token stops working
  if (acct.session && acct.session.access_token) authCall('logout', {}, acct.session.access_token).catch(() => {});
  acct.session = null; acct.key = null; acct.salt = null; acct.pulled = false;
  ls.del(SESSION_KEY); ls.del(OWNER_KEY); return keyStore.clear();
}
// Used by "Start over" in Settings: forget the login so an empty phone can never overwrite the account.
function acctForget() { forgetLogin(); setStatus('off'); }

// Newest copy wins. A phone that isn't set up yet, or has never been linked to this account, takes the account's copy.
async function openVault(password) {
  const rows = await rest('GET', '?select=state,updated_at&user_id=eq.' + acct.session.user_id);
  const row = rows && rows[0];
  const owner = ls.get(OWNER_KEY), mine = owner === acct.session.user_id;
  if (row && row.state && row.state.data) {
    const salt = unb64(row.state.salt);
    const key = password ? await vaultKey(password, salt) : acct.key;
    let remote;
    try { const prev = acct.key; acct.key = key; remote = await unseal(row.state); acct.key = prev; }
    catch (e) { await forgetLogin(); setStatus('off'); throw new Error('cant-decrypt'); }
    acct.key = key; acct.salt = salt;
    if (owner && !mine) { st = freshState(); priv = Object.assign(freshPriv(), { preview: priv.preview, sound: priv.sound }); }   // another player's data is never merged in
    const rt = new Date(remote.st.updatedAt || 0), lt = new Date(st.updatedAt || 0);
    acct.pulled = true;
    if (!mine || !st.onboarded || rt > lt) {
      const keep = {}; DEVICE_ONLY.forEach(k => { keep[k] = priv[k]; });
      st = cleanState(remote.st); priv = Object.assign(cleanPriv(remote.priv), keep);
      save(false); render(); if (st.onboarded) sys('Progress restored from your account.');
    } else if (lt > rt) await acctPush();
  } else {
    // No account copy yet (new account, or it was deleted on another phone): keep the key we have, or make one.
    if (password) { acct.salt = crypto.getRandomValues(new Uint8Array(16)); acct.key = await vaultKey(password, acct.salt); }
    if (!acct.key) throw new Error('signed-out');
    if (owner && !mine) { st = freshState(); priv = Object.assign(freshPriv(), { preview: priv.preview, sound: priv.sound }); }
    acct.pulled = true;
    await acctPush();
  }
  ls.set(OWNER_KEY, acct.session.user_id);
  await keyStore.put({ uid: acct.session.user_id, key: acct.key, salt: b64(acct.salt) });
  if (acct.status !== 'offline' && acct.status !== 'signedout') setStatus('ok');
}

/* ---------- Log in and create account ---------- */
function acctSheet(mode, msg) {
  const up = mode === 'signup';
  openSheet(`<h3>${up ? 'Create your account' : 'Log in'}</h3>
    <div class="small muted">${up ? 'Free. No emails are sent.' : 'Use the email and password you made your account with.'}</div>
    <label class="f">Email</label><input type="text" id="acEmail" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc((acct.session && acct.session.email) || '')}">
    <label class="f">Password${up ? ' (at least 8 characters)' : ''}</label><input type="password" id="acPass" autocomplete="${up ? 'new-password' : 'current-password'}">
    ${up ? `<label class="f">Repeat password</label><input type="password" id="acPass2" autocomplete="new-password">` : ''}
    <p class="small gold" id="acMsg" style="min-height:1.2em;margin:10px 0 0">${esc(msg || '')}</p>
    <div class="row" style="margin-top:8px"><button class="btn gold" data-act="acctGo" data-m="${up ? 'signup' : 'login'}">${acct.busy ? 'One moment…' : up ? 'Create account' : 'Log in'}</button>
    <button class="btn ghost" data-act="${up ? 'acctIn' : 'acctUp'}">${up ? 'I already have an account' : 'New here? Create an account'}</button></div>
    <p class="small muted" style="margin-top:12px">Your data is encrypted on this phone with your password before it syncs. Nobody else can read it, not even whoever runs the database. If you forget the password, the synced copy can't be unlocked, so keep the backup file too.</p>`);
  setTimeout(() => { const f = el('acEmail'); (f && !f.value ? f : el('acPass')).focus(); }, 50);
}
async function acctGo(mode) {
  if (acct.busy) return;
  const email = val('acEmail'), password = (el('acPass') || {}).value || '', say = t => { const m = el('acMsg'); if (m) m.textContent = t; };
  if (!/^\S+@\S+\.\S+$/.test(email)) return say('Enter a valid email address.');
  if (mode === 'signup') {
    if (password.length < 8) return say('Use at least 8 characters.');
    if (password !== ((el('acPass2') || {}).value || '')) return say("Those passwords don't match.");
  } else if (!password) return say('Enter your password.');
  acct.busy = true; say('One moment…');
  try {
    const secret = await loginSecret(email, password);
    const r = mode === 'signup' ? await authCall('signup', { email, password: secret }) : await authCall('token?grant_type=password', { email, password: secret });
    if (!r.ok) {
      acct.busy = false;
      const t = JSON.stringify(r.data || {});
      if (mode === 'signup' && /already|exists|registered/i.test(t)) return acctSheet('login', 'That email already has an account, maybe from Inner Citadel, which shares logins. Log in with that password, or use another email.');
      if (mode === 'login' && r.status === 400) return say('Wrong email or password. If this email is also your Inner Citadel login, use that password.');
      return say("Couldn't reach the account service. Check your connection and try again.");
    }
    if (!r.data.access_token) { acct.busy = false; return acctSheet('login', 'Account created. Log in now.'); }
    keepSession(r.data);
    await openVault(password);
    acct.busy = false; closeSheet(); render();
    sys(mode === 'signup' ? 'Account created. Your progress is encrypted and synced.' : 'Logged in. Your progress is encrypted and synced.', 'gold');
  } catch (e) {
    acct.busy = false;
    say(String(e && e.message) === 'cant-decrypt' ? "Logged in, but this password can't unlock the saved copy." : 'Something went wrong. Check your connection and try again.');
  }
}
async function acctLogout() {
  clearTimeout(pushTimer);
  if (acct.key && acct.session && acct.pulled) await acctPush();
  if (acct.status !== 'ok' && !confirm("Your latest changes haven't synced. Log out anyway? Anything not synced will be lost from this phone.")) return;
  await forgetLogin();
  // Logging out clears this phone. Everything stays safe, encrypted, in the account.
  ls.del(KEY); ls.del(PKEY); st = freshState(); priv = freshPriv();
  setStatus('off'); closeSheet(); render(); sys('Logged out. Your progress is safe in your account.');
}
async function acctDelete() {
  if (!acct.session || !confirm('Delete the copy saved in your account? Your progress on this phone stays.')) return;
  try {
    await rest('DELETE', '?user_id=eq.' + acct.session.user_id);
    await forgetLogin();
    setStatus('off'); sys('Account copy deleted. This phone keeps its progress.');
  } catch (e) { sys('Could not delete right now. Try again when you are online.'); }
}

/* ---------- Settings box ---------- */
function acctHtml() {
  if (acct.session && acct.status === 'signedout') return `<div class="small">Your session ended for <b>${esc(acct.session.email || '')}</b>. Log in again to keep syncing. Your progress is safe on this phone.</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="acctIn">Log in</button><button class="btn ghost small" data-act="acctOut">Log out</button></div>`;
  if (!acct.session || !acct.key) return `<div class="small muted">Make a free account to keep your progress safe and use it on any phone. Everything is encrypted on this phone first, so nobody else can read it.</div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="acctUp">Create account</button><button class="btn ghost" data-act="acctIn">Log in</button></div>`;
  const when = acct.last ? new Date(acct.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'not yet';
  const s = { ok: 'Encrypted and synced at ' + when, syncing: 'Syncing…', offline: 'Offline right now. Changes will sync when you are back online.', signedout: 'Your session ended. Log in again to keep syncing.', off: '' }[acct.status] || '';
  return `<div class="small">Logged in as <b>${esc(acct.session.email || '')}</b></div><div class="small muted">${esc(s)}</div>
    <div class="row" style="margin-top:8px"><button class="btn small" data-act="acctSync">Sync now</button><button class="btn ghost small" data-act="acctOut">Log out</button>
    <button class="btn ghost small" data-act="acctDel">Delete account copy</button></div>
    <div class="small muted" style="margin-top:6px">Logging out clears this phone. Your progress stays in your account for next time.</div>`;
}
function acctRefresh() { const b = el('acctBox'); if (b) b.innerHTML = acctHtml(); }
Object.assign(ACT, {
  acctIn: () => acctSheet('login'),
  acctUp: () => acctSheet('signup'),
  acctGo: d => acctGo(d.m),
  acctOut: () => acctLogout(),
  acctSync: async () => { await acctPush(); sys(acct.status === 'ok' ? 'Synced.' : 'Could not sync right now.'); },
  acctDel: () => acctDelete(),
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && /^acPass2?$/.test(e.target.id)) { const b = document.querySelector('[data-act=acctGo]'); if (b) acctGo(b.dataset.m); } });

/* ---------- Boot: quietly reconnect if this phone was logged in ---------- */
(async () => {
  const saved = ls.get(SESSION_KEY);
  if (!saved || !window.crypto || !crypto.subtle) return;
  try {
    acct.session = JSON.parse(saved);
    const k = await keyStore.get();
    if (!k || k.uid !== acct.session.user_id || !k.key) { acct.session = null; return; }
    acct.key = k.key; acct.salt = unb64(k.salt);
    await openVault(null);
  } catch (e) { setStatus(String(e && e.message) === 'signed-out' ? 'signedout' : 'offline'); }
})();
