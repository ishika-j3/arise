'use strict';
/* ARISE, Season 1.
   Two stores, both on this device only:
   - STATE (arise-state-v1): quests, gates, XP, setup. This is what will sync later.
   - PRIV (arise-private-v1): mind checks, low-energy reasons, cycle, birthday. Never synced, never exported.
*/

/* ---------------- Constants ---------------- */
const KEY = 'arise-state-v1', PKEY = 'arise-private-v1';
const CAP = 200;                                   // daily XP cap; past it is overtime (0 XP)
const SIZE_XP = { E: 10, D: 20, C: 35, B: 50 };
const SIZE_MANA = { E: 1, D: 2, C: 3, B: 5 };
const WEEK_MANA = { light: 25, normal: 18, heavy: 10 };
const S1_WEEKS = 8, S2_WEEKS = 12;                  // season lengths; the start date is set by each player
const PATHS = {
  body: { n: 'Body', c: '#7fd3a8' }, mind: { n: 'Mind', c: '#b3a8f5' }, work: { n: 'Work', c: '#8cc2f2' },
  guild: { n: 'Guild', c: '#f0c27f' }, life: { n: 'Life', c: '#f2a6c0' },
};
const HIDEABLE = ['work', 'guild'];                // Body, Mind and Life are always on
const LANE = { work: 'required', guild: 'optional', body: 'protected', mind: 'protected', life: 'protected' };
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
const DAILY = [
  { id: 'night', t: 'Night routine', full: 'Phone down, wind down, in bed by your bedtime', min: 'In bed within 30 minutes of it', main: true },
  { id: 'move', t: 'Move', full: '10-minute walk or stretch', min: '2 minutes', main: true },
  { id: 'fuel', t: 'Fuel', full: 'One proper meal with protein, and a water bottle', min: 'A meal and a glass of water', main: false },
  { id: 'mind', t: 'Mind check', full: 'One tap for how you feel, plus one line', min: 'Just the tap', main: true, sheet: 'mind' },
  { id: 'gates', t: 'Close the gates', full: 'Type tonight\'s open loops into the box', min: 'Tap "gates closed"', main: false, sheet: 'close' },
];
// Starting level sets the Move quest and the Body trials. Everyone can change the wording later.
const LEVELS = {
  zero: { n: 'Starting from zero', d: 'Little or no exercise right now', move: ['10-minute walk or stretch', '2 minutes'] },
  some: { n: 'Some activity', d: 'Walks or a workout now and then', move: ['20-minute walk or a beginner workout', '5 minutes'] },
  active: { n: 'Already active', d: 'Exercise most weeks', move: ['30 minutes of training or a brisk walk', 'A 10-minute walk'] },
};
// Low-energy reasons. Each one changes today's plan in a specific way, not just "do less".
const LOW = {
  period: { n: 'Period or cramps', move: 'Gentle walk, stretching or yoga. Full training is fine if you feel good. Over time, regular exercise is linked to less period pain.', fuel: 'Iron-rich food (dal, spinach, eggs, meat) and plenty of water. A hot water bottle counts as care.', night: 'Aim for extra sleep tonight.', gates: false },
  sick: { n: 'Unwell', pause: true },
  sleep: { n: 'Slept badly', move: 'Keep it easy: a walk, no hard training today.', fuel: 'Regular meals, and no caffeine after 2 pm.', night: 'Try to be in bed 30 minutes earlier tonight.', gates: false },
  work: { n: 'Heavy work day', move: 'The minimum counts in full. A 5-minute walk between calls is enough.', fuel: 'Eat a real meal away from the screen, even a short one.', night: 'Stop work at a set time and close the gates.', gates: true },
  mood: { n: 'Low mood', move: 'A short walk outside, in daylight if you can.', fuel: 'Eat something proper, even if you are not hungry.', night: 'Keep your usual bedtime and wake time. A steady routine helps mood.', gates: true },
  travel: { n: 'Travelling', move: 'Walking through the airport or station counts.', fuel: 'Water and one real meal.', night: 'Get to bed as close to your usual time as you can.', gates: true },
  tired: { n: 'Just tired', move: 'The minimum counts in full.', fuel: 'A real meal and water.', night: 'An early night is the quest.', gates: false },
};
// Cycle phases. Day 1 is the first day of a period. Ovulation is estimated from the average luteal
// phase of 12.4 days (Bull et al. 2019), so it is an estimate only. Sources are listed in README.md.
const LUTEAL = 12.4;
const CYCLE = {
  menstrual: { n: 'Period', tip: 'Energy is often lower on the first 1 to 2 days. Gentle movement and heat help many people with cramps. Train hard only if you feel like it. Eat iron-rich food.' },
  follicular: { n: 'Follicular', tip: 'Many people feel more energetic in this phase. A good week to try something harder, if you want to. Research says the difference is small, so go by how you feel.' },
  ovulation: { n: 'Around ovulation', tip: 'Energy is often good. Warm up properly before hard training.' },
  luteal: { n: 'Luteal', tip: 'Body temperature and resting heart rate rise a little, so hard sessions and heat can feel tougher. Appetite often goes up. That is normal, not a failure.' },
  late: { n: 'Late luteal (PMS window)', tip: 'Mood, sleep and energy can dip in the days before a period, and anxiety or low mood can feel stronger. If today feels heavy, it may be your cycle, and it usually lifts a few days into your period. Plan lighter days.' },
};
const SHADOW_NAMES = { move: 'Igris', fuel: 'Iron', night: 'Kaisel', gates: 'Greed' };
const SUPPORT_FLOORS = ['Write down 3 names or services (10 min)', 'Send one message', 'Book an intro call', 'Attend session 1', 'Attend session 3'];
const RAID_FLOORS = ['Idea and date', 'Venue', 'Price and break-even', 'Owner besides you', 'Listing and promo', 'Reminders', 'Run the event', 'Recap and numbers'];
const MOODS = [[1, 'Really low'], [2, 'Low'], [3, 'Okay'], [4, 'Good'], [5, 'Light']];
const TITLES = {
  zero: 'The One Who Started From Zero', night: 'Keeper of the Night Gate', rest: 'One Who Rests',
  commander: 'Commander', returner: 'The Returner', mist: 'Saw Through It',
};
const CHAPTERS = [
  { from: 1, t: 'Chapter 1: Steady Ground', p: 'You cleared every gate alone for a long time. The strongest players, it turns out, rest between raids. The System is not asking you to be stronger this season. It is asking you to be steady: to sleep, to move a little, to eat a real meal, to say how you feel and mean it. The gates will still come. They always do. But this time you are not going to carry them all at once. Some you will close. Some you will hand to your guild. Some, you will find, were never monsters at all.' },
  { from: 4, t: 'Chapter 2: The Mist', p: 'Four weeks in, the gates look different. Not fewer, but lighter. You have learned which ones are yours and which ones belong in someone else\'s hands. Some nights you still lie awake holding a list, so you type it into the box and let the System hold it instead. The Mist comes and goes. When it clears, it usually shows the same thing: an ordinary path, and you on it, still walking.' },
  { from: 8, t: 'Chapter 3: Midnights', p: 'At the end of the Midnights era the System shows you the tracklist: every trial you cleared, every gate you handed off, every night you closed on time. None of it was dramatic. That was the point. A hunter is not made in one raid. A hunter is made in the quiet days between them, choosing rest, and food, and the people who make you feel light. The next gate is already glowing. You get to choose whether to enter.' },
];

/* ---------------- Storage ---------------- */
function freshState() {
  return {
    v: 1, created: null, onboarded: false, xp: 0, xpLog: {}, days: {}, gates: [], mirages: [], weeks: {},
    ranks: { body: 'E', mind: 'E', work: 'E', guild: 'E', life: 'E' }, ticks: {}, trialLog: [],
    titles: [], equipped: null, chests: [], shadows: {}, cls: 'Solo Player', calm: 0, flags: {},
    safe: { active: false, days: [] }, kindWeek: null, returnDone: {}, overtimeShown: {}, seq: 1,
    rewards: ['An evening with no Gates', 'A new book', 'A solo creative session', 'A long call with a friend'],
    // setup, chosen by each player
    name: '', level: 'zero', seasonStart: '', pathNames: {}, hidden: [], hostName: '', dq: {}, support: false,
    plannedSafe: [], lastBackup: '', nudged: '',
    // One small good thing a day: a mix of pleasant things and small "I did it" things (behavioural activation)
    goodList: ['10 minutes in daylight', 'A song you love, properly listened to', 'Message someone you like', 'A shower and fresh clothes',
      '10 pages of a book', 'Tidy one surface', 'Something tasty, eaten slowly', 'Step outside, even for 2 minutes'],
  };
}
function freshPriv() {
  // moodLog keeps only the 1 to 5 number for 90 days, so patterns (activity, cycle) can show. Written lines go after 14.
  return { mind: {}, moodLog: {}, low: {}, cycle: { on: false, hormonal: false, starts: [], len: 28, plen: 5 }, birthday: '', sound: true, preview: false, dateOverride: '' };
}
function load(k, fresh) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v ? Object.assign(fresh(), v) : fresh(); } catch (e) { return fresh(); }
}
let st = load(KEY, freshState);
let priv = load(PKEY, freshPriv);
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); localStorage.setItem(PKEY, JSON.stringify(priv)); } catch (e) { /* storage blocked: app still works this session */ }
}

/* ---------------- Dates ---------------- */
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() {
  if (priv.dateOverride) return priv.dateOverride;
  const d = new Date(); if (d.getHours() < 4) d.setDate(d.getDate() - 1); // a day ends at 4am, so 12:30am counts for "tonight"
  return ymd(d);
}
function addDays(k, n) { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return ymd(d); }
function dow(k) { return new Date(k + 'T12:00:00').getDay(); } // 0 = Sunday
function weekKey(k) { const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); }
function daysBetween(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000); }
function nice(k) { return new Date(k + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); }
function lateNight() { const h = new Date().getHours(); return h >= 22 || h < 5; }

function nextMonday(k) { const d = dow(k); return addDays(k, d === 1 ? 0 : (8 - d) % 7 || 7); }
// Season dates come from the player's own start date, so nothing personal lives in the code.
function cal() {
  const s1 = st.seasonStart || nextMonday(today());
  return { s1Start: s1, s1End: addDays(s1, S1_WEEKS * 7 - 1), s2Start: addDays(s1, S1_WEEKS * 7), s2End: addDays(s1, (S1_WEEKS + S2_WEEKS) * 7 - 1) };
}
function phase(k = today()) {
  const c = cal();
  if (k < c.s1Start) return { id: 'warmup', name: 'Warm-up', w: 0 };
  if (k <= c.s1End) return { id: 's1', name: 'Season 1: Steady Ground', w: Math.floor(daysBetween(c.s1Start, k) / 7) + 1 };
  if (k <= c.s2End) return { id: 's2', name: 'Season 2', w: 99 };
  return { id: 'after', name: 'Season review due', w: 99 };
}
const NEED = { review: 1, mirages: 1, raids: 1, rituals: 1, mana: 2, dungeons: 2, waiting: 2, trials: 3, shadows: 4, titles: 4, chests: 4, eras: 4 };
function on(f) { return priv.preview || phase().w >= (NEED[f] || 0); }
function inSeason() { return phase().id === 's1'; }
function trialStart() { return priv.preview ? '0000' : cal().s1Start; }

function isBirthday(k) { return !!priv.birthday && k.slice(5) === priv.birthday.slice(5); }
function isSafe(k) { return st.plannedSafe.some(r => k >= r.from && k <= r.to) || st.safe.days.includes(k) || isBirthday(k); }
function safeNow() { return st.safe.active || isSafe(today()); }

/* ---------------- Setup helpers ---------------- */
function pathName(p) { return st.pathNames[p] || PATHS[p].n; }
function paths() { return Object.keys(PATHS).filter(p => !st.hidden.includes(p)); }
function dq(q) {
  const o = st.dq[q.id] || {};
  const lv = q.id === 'move' ? LEVELS[st.level] || LEVELS.zero : null;
  return { full: o.full || (lv ? lv.move[0] : q.full), min: o.min || (lv ? lv.move[1] : q.min) };
}

/* ---------------- Cycle (optional, private) ---------------- */
function cycleLen() {
  const s = priv.cycle.starts.slice().sort();
  const gaps = [];
  for (let i = 1; i < s.length; i++) { const g = daysBetween(s[i - 1], s[i]); if (g >= 20 && g <= 45) gaps.push(g); }
  const recent = gaps.slice(-6);
  return recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : Number(priv.cycle.len) || 28;
}
function cycleDay(k = today()) {
  if (!priv.cycle.on || !priv.cycle.starts.length) return null;
  const last = priv.cycle.starts.filter(x => x <= k).sort().pop(); if (!last) return null;
  const day = daysBetween(last, k) + 1, len = cycleLen(), plen = Number(priv.cycle.plen) || 5, ov = Math.round(len - LUTEAL);
  let ph;
  if (day <= plen) ph = 'menstrual';
  else if (day > len + 7) ph = null;              // much later than usual: ask, don't guess
  else if (day < ov - 1) ph = 'follicular';
  else if (day <= ov + 1) ph = 'ovulation';
  else if (day > len - 5) ph = 'late';
  else ph = 'luteal';
  return { day, len, ph, next: addDays(last, len) };
}
function phasesOn() { return priv.cycle.on && !priv.cycle.hormonal; }   // hormonal contraception: no natural phases

/* ---------------- Patterns from your own data ---------------- */
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
// Mood on days you did a thing vs days you didn't, over the last 28 days. Needs 3+ days on each side.
function moodLink(did) {
  const yes = [], no = [];
  for (let i = 0; i < 28; i++) {
    const k = addDays(today(), -i), m = priv.moodLog[k]; if (!m) continue;
    (did(st.days[k] || {}) ? yes : no).push(m);
  }
  return yes.length >= 3 && no.length >= 3 ? { yes: avg(yes), no: avg(no), n: yes.length + no.length } : null;
}
// Do low days cluster in the premenstrual window (last 5 days of the cycle and period days 1 to 2)?
function cyclePattern() {
  if (!phasesOn() || priv.cycle.starts.length < 2) return null;
  const pre = [], rest = [];
  Object.keys(priv.moodLog).forEach(k => {
    const c = cycleDay(k); if (!c || !c.ph) return;
    (c.ph === 'late' || (c.ph === 'menstrual' && c.day <= 2) ? pre : rest).push(priv.moodLog[k]);
  });
  if (pre.length < 4 || rest.length < 8) return null;
  return { pre: avg(pre), rest: avg(rest), lower: avg(rest) - avg(pre) >= 0.7 };
}

/* ---------------- XP and levels ---------------- */
function levelInfo(xp = st.xp) { let l = 1, rem = xp, need = 75; while (rem >= need) { rem -= need; l++; need = 50 + 25 * l; } return { l, rem, need }; }
function playerRank(l) { return l < 10 ? 'E' : l < 20 ? 'D' : l < 30 ? 'C' : l < 50 ? 'B' : l < 70 ? 'A' : l < 100 ? 'S' : 'National'; }
function award(base, o = {}) {
  const amt = Math.round(base * (o.bonus ? 1.5 : 1));
  const k = today(), used = st.xpLog[k] || 0;
  const got = Math.max(0, Math.min(amt, CAP - used));
  const before = levelInfo().l;
  st.xpLog[k] = used + got; st.xp += got;
  if (got < amt && !st.overtimeShown[k]) { st.overtimeShown[k] = 1; sys('Overtime. No XP past the daily cap. The Player may stop.'); }
  const after = levelInfo().l;
  if (after > before) { sys('LEVEL UP! Level ' + after, 'gold'); sound('ring'); }
  return got;
}
function unaward(n, k = today()) { st.xp = Math.max(0, st.xp - n); st.xpLog[k] = Math.max(0, (st.xpLog[k] || 0) - n); }

/* ---------------- Days, rolling count ---------------- */
function dayRec(k = today()) { return st.days[k] || (st.days[k] = { xp: {} }); }
function dayDone(k) { const r = st.days[k]; return !!(r && DAILY.some(x => r[x.id])); }
function shownUp() {
  const t = today(); let n = 0, d = 0;
  for (let i = 0; i < 14; i++) { const k = addDays(t, -i); if (!st.created || k < st.created || isSafe(k)) continue; d++; if (dayDone(k)) n++; }
  return { n, d };
}
function missed(k) { return !!st.created && k >= st.created && k < today() && !isSafe(k) && !dayDone(k); }
function cnt14(pred) {
  const t = today(); let n = 0;
  for (let i = 0; i < 14; i++) { const k = addDays(t, -i); if (k < trialStart() || isSafe(k)) continue; if (pred(k)) n++; }
  return n;
}

/* ---------------- Weeks, Mana ---------------- */
function wk(k = today()) { const key = weekKey(k); return st.weeks[key] || (st.weeks[key] = { type: 'normal', adjust: 0, rituals: {}, holds: {}, reviewed: false, over: false }); }
function lastWeeks(n) { const out = []; let k = weekKey(today()); for (let i = 0; i < n; i++) { out.push(st.weeks[k] || null); k = addDays(k, -7); } return out; }
function weeksHeld(p) { return lastWeeks(4).filter(w => w && w.holds[p] === true).length; }
function weeksRitual(r) { return lastWeeks(4).filter(w => w && w.rituals[r]).length; }
function gateCost(g) {
  if (g.state !== 'open' || !g.path) return 0;
  if (g.owner && g.owner !== 'me') return 1;
  return LANE[g.path] === 'optional' ? SIZE_MANA[g.size] : 0;
}
function manaInfo() {
  const w = wk();
  const total = Math.max(0, WEEK_MANA[w.type] + (w.adjust || 0));
  const rituals = ['guild', 'wb'].filter(r => w.rituals[r]).length;
  const used = st.gates.reduce((s, g) => s + gateCost(g), 0) + rituals;
  return { total, used, over: used > total };
}
function swapSuggestion() {
  const soon = addDays(today(), 7);
  const c = st.gates.filter(g => gateCost(g) > 1 && g.owner === 'me' && !(g.date && g.date <= soon))
    .sort((a, b) => gateCost(b) - gateCost(a));
  return c[0] || null;
}

/* ---------------- Gates ---------------- */
function newGate(o) {
  const g = Object.assign({ id: 'g' + (st.seq++), title: '', path: null, size: 'E', state: 'open', date: '', owner: 'me', checkBack: '',
    floors: null, floorIdx: 0, raid: null, created: today(), touched: today(), done: '', night: false, builtin: null, back: false, repeat: '' }, o);
  st.gates.push(g); return g;
}
function findGate(id) { return st.gates.find(g => g.id === id); }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
function wakeWaiting() {
  st.gates.forEach(g => { if (g.state === 'waiting' && g.checkBack && g.checkBack <= today()) { g.state = 'open'; g.back = true; g.touched = today(); } });
}
function makeRaid(g, grand) {
  g.path = 'guild'; if (g.size === 'E') g.size = 'C';
  g.floors = RAID_FLOORS.map(t => ({ t, done: '' })); g.floorIdx = 0;
  g.raid = { costs: '', price: '', be: null, owner: '', sold: '', spent: '', ad: '', grand: !!grand, skipped: {} };
}
function breakEven(r) { const c = Number(r.costs), p = Number(r.price); return c > 0 && p > 0 ? Math.ceil(c / p) : null; }
function cleanRaids() { return st.gates.filter(g => g.raid && g.state === 'done' && !g.raid.grand && !g.raid.skipped[2] && !g.raid.skipped[3] && g.raid.owner).length; }

function clearGate(g) {
  if (g.floors) return clearFloor(g);
  g.state = 'done'; g.done = today(); g.touched = today();
  const handed = g.owner && g.owner !== 'me';
  award(SIZE_XP[g.size], { bonus: inSeason() && handed && g.path === 'guild' });
  if (handed) { st.flags.commanded = (st.flags.commanded || 0) + 1; sys('Gate cleared by your guild. The Monarch did not have to lift a hand.'); }
  else sys('Gate cleared.');
  if (g.repeat) {
    // a repeating gate comes back by itself, so it never has to be typed again
    const next = addDays(g.date && g.date > today() ? g.date : today(), g.repeat === 'weekly' ? 7 : 1);
    newGate({ title: g.title, path: g.path, size: g.size, owner: g.owner, repeat: g.repeat, date: next, state: 'waiting', checkBack: next });
  }
  sound('chime'); checkTitles();
}
function clearFloor(g, skip) {
  const i = g.floorIdx, f = g.floors[i]; if (!f) return;
  if (g.raid && !skip) {
    if (i === 2) { const be = breakEven(g.raid); if (be === null) return sys('Raid Assessment incomplete. Add costs and a ticket price first.'); g.raid.be = be; }
    if (i === 3 && !String(g.raid.owner).trim()) return sys('Raid Assessment incomplete. Name an owner besides you first.');
  }
  if (skip && g.raid) g.raid.skipped[i] = true;
  f.done = today(); g.touched = today();
  const bonus = inSeason() && (g.builtin === 'support' || (g.raid && (i === 2 || i === 3) && !skip));
  // An avoided gate pays its full XP for starting, because starting is the hard part.
  const started = g.avoid && i === 0;
  award(g.raid && i === 6 ? SIZE_XP.C : started ? SIZE_XP[g.size] : 10, { bonus: bonus || started });
  g.floorIdx++;
  if (started && g.floorIdx < g.floors.length) { sys('You started. That was the hard part, and it has been paid in full.', 'gold'); sound('ring'); checkTitles(); return; }
  if (g.raid && g.floorIdx === 4) {
    const ok = !g.raid.skipped[2] && !g.raid.skipped[3];
    sys(ok ? 'Raid Assessment: viable. Break-even confirmed. Party assembled.' : 'Raid Assessment skipped for this one. The rule starts with the next event.', ok ? 'gold' : '');
  }
  if (g.raid && i === 4 && st.cls === 'Solo Player' && !g.raid.skipped[2] && !g.raid.skipped[3] && g.raid.owner) {
    st.cls = 'Guild Master'; setTimeout(() => { sys('Job Change complete. Class: Guild Master.', 'gold'); sound('ring'); }, 900);
  }
  if (g.floorIdx >= g.floors.length) {
    g.state = 'done'; g.done = today();
    if (!g.avoid) award(SIZE_XP[g.size]);
    if (g.raid) {
      const r = g.raid, sold = Number(r.sold), price = Number(r.price), spent = Number(r.spent);
      const covered = sold > 0 && price > 0 && spent >= 0 && sold * price >= spent;
      sys(covered ? 'Raid cleared. Costs covered.' : 'Raid cleared. The numbers are in.', 'gold');
    } else sys('Dungeon cleared: ' + g.title, 'gold');
    sound('ring');
  } else if (!(g.raid && g.floorIdx === 4)) { sys('Floor cleared. Next: ' + g.floors[g.floorIdx].t); sound('chime'); }
  checkTitles();
}

/* ---------------- Trials ---------------- */
const TRIALS = {
  body: {
    E: [{ t: 'Moved on 10 of 14 days', a: () => [cnt14(k => st.days[k] && st.days[k].move), 10] },
        { t: 'Full night routine on 8 of 14 nights', a: () => [cnt14(k => st.days[k] && st.days[k].night === 'full'), 8] }],
    D: { zero: [{ t: 'Hunter Assessment done (start of Season 2)' }, { t: '3 weekly longer walks' }],
         some: [{ t: 'Hunter Assessment done' }, { t: '2 strength sessions a week for 3 weeks' }],
         active: [{ t: 'Hunter Assessment done' }, { t: '3 training sessions a week for 4 weeks' }] },
    C: { zero: [{ t: '5K walk without stopping' }],
         some: [{ t: '5K in under 45 minutes' }, { t: '10 full push-ups (knees are fine to start)' }],
         active: [{ t: 'Hunter Assessment improved on 3 of 5 tests' }] },
  },
  mind: {
    E: [{ t: 'Mind check on 10 of 14 days', a: () => [cnt14(k => !!priv.mind[k]), 10] },
        { t: 'First Mirage window used', a: () => [st.flags.mirageWindow ? 1 : 0, 1] }],
    D: [{ t: 'Used a calming tool 5 times', a: () => [Math.min(st.calm, 5), 5] },
        { t: 'Let go of 3 Mirages', a: () => [Math.min(st.mirages.filter(m => m.status === 'letgo').length, 3), 3] }],
    C: [{ t: 'Support Dungeon floors 1 to 3 cleared', a: () => { const g = st.gates.find(x => x.builtin === 'support'); return [g ? Math.min(g.floorIdx, 3) : 0, 3]; } },
        { t: 'Early-warning list written: 3 signs a low patch is starting' }],
  },
  work: {
    E: [{ t: 'Held the line 3 weeks out of 4', a: () => [weeksHeld('work'), 3] }],
    D: [{ t: 'Every open work Gate has a date or a Waiting check-back, 2 weeks running' }, { t: 'One feedback conversation asked for' }],
    C: [{ t: 'Next-step Dungeon cleared up to "two conversations had"' }, { t: 'One week where work stayed inside the hours you set' }],
  },
  guild: {
    E: [{ t: 'Guild check-in 3 weeks out of 4', a: () => [weeksRitual('guild'), 3] },
        { t: 'Every open Guild Gate has an owner', a: () => [st.gates.some(g => g.path === 'guild' && g.state === 'open' && !g.owner) ? 0 : 1, 1] }],
    D: [{ t: 'One Raid cleared with break-even shown before announcing and an owner besides you', a: () => [Math.min(cleanRaids(), 1), 1] },
        { t: '5 handed-off Gates finished by someone else', a: () => [Math.min(st.flags.commanded || 0, 5), 5] }],
    C: [{ t: '3 Raids in a row with numbers shown first', a: () => [Math.min(cleanRaids(), 3), 3] },
        { t: 'First session of your hosted circle run' }, { t: 'One role fully handed over' }],
  },
  life: {
    E: [{ t: 'A friend or family contact 3 weeks out of 4', a: () => [weeksRitual('friend'), 3] },
        { t: 'One creative or reading block each week (4 weeks)', a: () => [weeksRitual('joy'), 4] }],
    D: [{ t: 'One plan with friends where you just turn up, not organise' }, { t: 'One creative session as a participant' }],
    C: [{ t: 'A friend plan you just turned up to, 4 weeks in a row' }, { t: 'One book finished' }],
  },
};
function trialItems(p) {
  const r = st.ranks[p], set = TRIALS[p][r];
  const list = Array.isArray(set) ? set : set ? set[st.level] || set.zero : [];
  return list.map((it, i) => {
    if (it.a) { const [n, of] = it.a(); return { t: it.t, n, of, done: n >= of, auto: true, i }; }
    const done = !!st.ticks[p + r + i]; return { t: it.t, n: done ? 1 : 0, of: 1, done, auto: false, i };
  });
}
function trialReady(p) { const it = trialItems(p); return it.length > 0 && it.every(x => x.done); }
function clearTrial(p) {
  const from = st.ranks[p], to = RANKS[RANKS.indexOf(from) + 1]; if (!to) return;
  st.ranks[p] = to; st.trialLog.push({ p, from, to, date: today() });
  sys('Path Trial cleared. ' + pathName(p) + ' has reached Rank ' + to + '.', 'gold'); sound('ring');
  const item = st.rewards.length ? st.rewards[Math.floor(Math.random() * st.rewards.length)] : null;
  if (item) { st.chests.push({ item, date: today() }); setTimeout(() => sys('A reward chest dropped: ' + item, 'gold'), 1200); }
}

/* ---------------- Titles, shadows ---------------- */
function checkTitles() {
  const give = t => { if (!st.titles.includes(t)) { st.titles.push(t); if (on('titles')) setTimeout(() => sys('Title earned: ' + TITLES[t], 'gold'), 700); } };
  if (Object.keys(st.days).some(dayDone)) give('zero');
  if ((st.flags.closed || 0) >= 7) give('night');
  if (st.flags.rested) give('rest');
  if ((st.flags.commanded || 0) >= 5) give('commander');
  if (st.flags.returned) give('returner');
  if (st.mirages.some(m => m.status === 'letgo')) give('mist');
}
function shadowReady(id) {
  if (id === 'mind' || st.shadows[id]) return false;
  const t = today(); let n = 0, d = 0;
  for (let i = 0; i < 30; i++) { const k = addDays(t, -i); if (!st.created || k < st.created || isSafe(k)) continue; d++; if (st.days[k] && st.days[k][id]) n++; }
  return d >= 30 && n >= 24;
}

/* ---------------- Private data upkeep ---------------- */
function pruneMind() {
  const cut = addDays(today(), -14);
  Object.keys(priv.mind).forEach(k => { if (k < cut) delete priv.mind[k]; });
  Object.keys(priv.low).forEach(k => { if (k < cut) delete priv.low[k]; });
  Object.keys(priv.mind).forEach(k => { if (!priv.moodLog[k]) priv.moodLog[k] = priv.mind[k].s; });
  const cut90 = addDays(today(), -90);
  Object.keys(priv.moodLog).forEach(k => { if (k < cut90) delete priv.moodLog[k]; });
  priv.cycle.starts = priv.cycle.starts.sort().slice(-8);   // enough to average the last 6 cycles
}

/* ---------------- Sound ---------------- */
let actx = null;
function soundAllowed(kind) {
  if (!priv.sound || safeNow()) return false;
  if (lateNight()) return kind === 'hum';
  return true;
}
function sound(kind) {
  if (!soundAllowed(kind)) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const now = actx.currentTime;
    const tone = (f, start, dur, type = 'sine', vol = .08) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, now + start);
      g.gain.setValueAtTime(0, now + start); g.gain.linearRampToValueAtTime(vol, now + start + .02);
      g.gain.exponentialRampToValueAtTime(.0001, now + start + dur);
      o.connect(g); g.connect(actx.destination); o.start(now + start); o.stop(now + start + dur + .05);
    };
    if (kind === 'chime') { tone(1318, 0, .5); tone(1975, .06, .6, 'sine', .04); }
    if (kind === 'ring') { tone(659, 0, .9, 'triangle', .07); tone(988, .12, 1.0, 'sine', .06); tone(1318, .24, 1.2, 'sine', .04); }
    if (kind === 'hum') { tone(110, 0, 1.6, 'sine', .07); tone(165, .1, 1.4, 'sine', .03); }
  } catch (e) { /* audio not available */ }
}

/* ---------------- UI helpers ---------------- */
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }
function sys(msg, kind) {
  const t = document.createElement('div');
  t.className = 'system' + (kind === 'gold' ? ' goldt' : '');
  t.innerHTML = `<div class="line">${esc(msg)}</div>`;
  t.onclick = () => t.remove();
  el('toasts').appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
function pathChip(p) { return p ? `<span class="chip path" style="background:${PATHS[p].c}">${esc(pathName(p))}</span>` : '<span class="chip gold">Sort me</span>'; }
function openSheet(html) { el('sheet').innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`; el('sheet').hidden = false; }
function closeSheet() { el('sheet').hidden = true; el('sheet').innerHTML = ''; }
function ripple() { const r = document.createElement('div'); r.className = 'ripple'; document.body.appendChild(r); setTimeout(() => r.remove(), 1200); }
function val(id) { const x = el(id); return x ? x.value.trim() : ''; }

let tab = 'today', showLate = false, mirageOpenNow = false, showAllToday = false;

/* ---------------- Render: Today ---------------- */
function morningLine() {
  const ph = phase(), t = today(), who = st.name || 'Player';
  if (isBirthday(t)) return 'Today the System asks nothing of you. Happy birthday, ' + who + '.';
  if (priv.low[t] === 'sick') return 'Rest is the only quest today. Nothing counts against you.';
  if (safeNow()) return 'You are inside the borders. Nothing follows you in.';
  if (ph.id === 'warmup') return 'Warm-up. Minimum versions count in full. Rest is the quest.';
  if (ph.id === 's1') return 'Daily Quest: Steady Ground has arrived. Minimum versions count in full.';
  return 'Daily Quest has arrived. Minimum versions count in full.';
}
function cycleCard() {
  if (!priv.cycle.on) return '';
  const c = cycleDay();
  if (!priv.cycle.starts.length) return `<div class="card"><div class="spread"><span class="small muted">Cycle: add the first day of your last period to see your phase.</span>
    <button class="btn small" data-act="settings">Add</button></div></div>`;
  if (priv.cycle.hormonal) return `<div class="card"><div class="spread"><span class="chip" style="color:var(--era-accent)">${c ? 'Day ' + c.day + ' since your last bleed' : 'Cycle'}</span>
    <button class="btn ghost small" data-act="periodStart">Bleed started today</button></div>
    <p class="small muted" style="margin:8px 0 0">On hormonal contraception your hormones stay fairly level, so there are no phase tips. Use "Low energy today?" on hard days.</p></div>`;
  if (!c || !c.ph) return `<div class="card"><div class="spread"><span class="small">Your period is later than your usual cycle. Tap when it starts.</span>
    <button class="btn small" data-act="periodStart">Started today</button></div></div>`;
  const P = CYCLE[c.ph], soon = c.ph === 'late' || c.day >= c.len - 2;
  return `<div class="card"><div class="spread"><span class="chip" style="color:var(--era-accent)">Cycle day ${c.day} · ${esc(P.n)}</span>
    ${c.ph !== 'menstrual' || c.day > 1 ? `<button class="btn ghost small" data-act="periodStart">Period started today</button>` : ''}</div>
    <p class="small" style="margin:8px 0 0">${esc(P.tip)}</p>
    ${soon ? `<p class="small muted" style="margin:6px 0 0">Next period likely around ${nice(c.next)}. An estimate, not a promise.</p>` : ''}
    <p class="small muted" style="margin:6px 0 0">How you feel today beats the calendar.</p></div>`;
}
function lowCard() {
  const t = today(), why = priv.low[t];
  if (!why) return `<div class="row" style="margin:4px 0 0"><button class="btn ghost small" data-act="lowOpen">Low energy today?</button></div>`;
  return `<div class="system"><div class="line">Today: ${esc(LOW[why].n)}. The quest has been adjusted.</div>
    <div class="small" style="margin-top:6px">Each item below shows today's version. Doing it counts in full.</div>
    <div class="row" style="margin-top:8px"><button class="btn ghost small" data-act="lowOpen">Change</button><button class="btn ghost small" data-act="lowClear">I'm fine now</button></div></div>`;
}
function backupCard() {
  const t = today(), since = st.lastBackup || st.created;
  if (!since || daysBetween(since, t) < 7 || st.nudged === weekKey(t)) return '';
  return `<div class="card"><div class="spread"><span class="small">Weekly backup. Save a copy so a lost or reset phone doesn't lose your progress.</span>
    <div class="row" style="flex-wrap:nowrap"><button class="btn small" data-act="export">Save</button><button class="btn ghost small" data-act="nudgeLater">Later</button></div></div></div>`;
}
function renderToday() {
  const t = today(), r = st.days[t] || {}, y = addDays(t, -1), ph = phase(), low = LOW[priv.low[t]];
  let h = `<div class="system"><div class="line">${esc(morningLine())}</div>
    <div class="row small muted" style="margin-top:8px"><span class="chip sys">${esc(ph.name)}${ph.id === 's1' ? ' · Week ' + ph.w : ''}</span>
    ${ph.id === 'warmup' ? `<span class="chip">Season 1 opens ${nice(cal().s1Start)}</span>` : ''}</div></div>`;

  if (safeNow()) {
    const sick = priv.low[t] === 'sick';
    h += `<div class="card"><p>Quests are paused. Nothing is lost, and these days don't count against you.</p>
      <div class="row"><button class="btn" data-act="sheet" data-s="mind">Mind check (optional)</button>
      ${sick ? '<button class="btn gold" data-act="lowClear">I feel better</button>' : st.safe.active ? '<button class="btn gold" data-act="ready">I\'m ready</button>' : ''}</div></div>`;
    return h + cycleCard() + footerLinks();
  }

  if (missed(y) && !st.returnDone[t]) {
    h += `<div class="system"><div class="line">Welcome back, ${esc(st.name || 'Player')}. No penalty has been applied.</div>
      <p class="small" style="margin:8px 0">Return Quest, if you want it: drink a glass of water and open today's quest.</p>
      <div class="row"><button class="btn gold small" data-act="returnDo">Done</button><button class="btn ghost small" data-act="returnSkip">Not today</button></div></div>`;
  }
  if (missed(y) && missed(addDays(y, -1)) && !st.safe.active) {
    h += `<div class="card"><p>Two quiet days in a row. Want the Safe Zone for a bit? No reason needed.</p>
      <button class="btn" data-act="safeOn">Enter the Safe Zone</button></div>`;
  }

  h += backupCard() + cycleCard() + lowCard();
  const su = shownUp();
  h += `<div class="card"><div class="spread"><h3>Daily Quest</h3><span class="chip">Shown up: ${su.n} of the last ${su.d || 0} days</span></div>`;
  DAILY.forEach((q, i) => {
    const v = r[q.id], sh = st.shadows[q.id], txt = dq(q), tip = low && low[q.id];
    const label = sh ? `<span class="chip gold">Shadow: ${esc(sh.name)}</span>` : '';
    let acts;
    if (q.sheet) {
      acts = v ? `<button class="btn on small" data-act="sheet" data-s="${q.sheet}">${q.id === 'mind' ? 'Checked in' : 'Gates closed'}</button>`
        : `<button class="btn small" data-act="sheet" data-s="${q.sheet}">${q.id === 'mind' ? 'Check in' : 'Close the gates'}</button>`;
    } else {
      acts = `<button class="btn small ${v === 'full' ? 'on' : ''}" data-act="daily" data-id="${q.id}" data-m="full">Done</button>
        <button class="btn small ${v === 'min' ? 'on' : ''}" data-act="daily" data-id="${q.id}" data-m="min">Minimum</button>`;
    }
    h += `<div class="quest ${v ? 'done' : ''}"><div class="num">${i + 1}</div><div class="body">
      <div class="t">${esc(q.t)} ${label}</div><div class="d">${tip ? `<span style="color:var(--sys)">Today: ${esc(tip)}</span>` : `${esc(txt.full)} <span class="muted">(minimum: ${esc(txt.min)})</span>`}</div>
      <div class="acts">${acts}</div></div></div>`;
  });
  h += `</div>`;

  h += r.good
    ? `<div class="card"><div class="spread"><div><h3>One small good thing</h3><div class="small" style="color:#c9f2dc">✓ ${esc(r.good)}</div></div>
      <button class="btn ghost small" data-act="goodUndo">Change</button></div></div>`
    : `<div class="card"><h3>One small good thing</h3><div class="small muted">Pick one and do it. Mood often follows action, not the other way round.</div>
      <div class="row" style="margin-top:8px">${st.goodList.map((x, i) => `<button class="btn small" data-act="goodPick" data-i="${i}">${esc(x)}</button>`).join('')}</div></div>`;

  h += `<div class="card"><div class="spread"><div><h3>Rest block</h3><div class="small muted">Rest earns XP here. It counts as much as work.</div></div>
    <button class="btn" data-act="rest">Log rest</button></div></div>`;

  if (on('rituals')) {
    const w = wk();
    const item = (id, t, lane) => `<button class="btn small ${w.rituals[id] ? 'on' : ''}" data-act="ritual" data-id="${id}">${w.rituals[id] ? '✓ ' : ''}${t}</button>`;
    h += `<div class="card"><h3>This week</h3><div class="row">
      ${paths().includes('guild') ? item('guild', pathName('guild') + ' check-in') : ''}${item('friend', 'Friend or family')}${item('joy', 'Creative or reading block')}
      ${st.flags.wbActive && st.hostName ? item('wb', esc(st.hostName)) : ''}</div>
      <div class="small muted" style="margin-top:8px">Sunday review: ${w.reviewed ? 'done' : 'on the Week tab'}</div></div>`;
  }
  if (on('mana')) h += manaCard();
  h += seasonCard();
  return h + footerLinks();
}
function manaCard() {
  const m = manaInfo(), pct = m.total ? Math.min(100, Math.round(m.used / m.total * 100)) : 100;
  let h = `<div class="card"><div class="spread"><h3>Mana</h3><span class="chip">${m.used} of ${m.total}</span></div>
    <div class="bar ${m.over ? 'gold' : ''}"><i style="width:${pct}%"></i></div>
    <div class="small muted" style="margin-top:6px">Work commitments don't use Mana. Friends, family and rest cost nothing.</div>`;
  if (m.over) {
    const g = swapSuggestion();
    h += g ? `<div class="system" style="margin-top:10px"><div class="line">Move "${esc(g.title)}" to next week?</div>
      <div class="row" style="margin-top:8px"><button class="btn gold small" data-act="swapYes" data-id="${g.id}">Yes</button>
      <button class="btn ghost small" data-act="gate" data-id="${g.id}">Other options</button></div></div>`
      : `<p class="small gold" style="margin:8px 0 0">The week is full. Anything new can wait, be handed off, or shrink.</p>`;
  }
  return h + '</div>';
}
function seasonCard() {
  const ph = phase();
  if (!on('eras') || ph.id !== 's1' && !priv.preview) return '';
  const w = ph.id === 's1' ? ph.w : 1;
  const ch = CHAPTERS.filter(c => c.from <= w || priv.preview);
  return `<div class="card" style="border-color:rgba(142,140,216,.45)"><div class="spread"><h3>The Midnights era</h3><span class="chip" style="color:var(--era-accent)">Season 1</span></div>
    ${ch.map(c => `<details><summary class="small" style="cursor:pointer;color:var(--era-accent)">${esc(c.t)}</summary><p class="chapter">${esc(c.p)}</p></details>`).join('')}</div>`;
}
function footerLinks() {
  return `<div class="footer-links">${safeNow() ? '<span></span>' : '<button data-act="safeOn">Safe Zone</button>'}<span></span></div>`;
}

/* ---------------- Render: Gates ---------------- */
function gateRow(g) {
  let meta = pathChip(g.path) + `<span class="chip">${g.size}</span>`;
  if (g.date) meta += `<span class="chip ${g.date <= today() ? 'gold' : ''}">${nice(g.date)}</span>`;
  if (g.owner && g.owner !== 'me') meta += `<span class="chip sys">Commanded: ${esc(g.owner)}</span>`;
  if (g.state === 'waiting') meta += `<span class="chip">Waiting until ${nice(g.checkBack)}</span>`;
  if (g.back) meta += `<span class="chip gold">Check back</span>`;
  if (g.repeat) meta += `<span class="chip">Repeats ${g.repeat}</span>`;
  if (g.raid) meta += `<span class="chip gold">Raid${g.raid.grand ? ' (grandfathered)' : ''}</span>`;
  else if (g.avoid && g.floorIdx === 0) meta += `<span class="chip gold">Just start: ${esc(g.floors[0].t)}</span>`;
  else if (g.floors) meta += `<span class="chip sys">Dungeon</span>`;
  let extra = '';
  if (g.floors && g.state !== 'done') {
    extra = `<div class="floors">${g.floors.map((f, i) => `<i class="${i < g.floorIdx ? 'd' : i === g.floorIdx ? 'n' : ''}"></i>`).join('')}</div>
      <div class="small">Next floor: ${esc(g.floors[g.floorIdx].t)}</div>`;
  }
  if (g.state === 'open' && g.path && !g.floors && daysBetween(g.created, today()) >= 14 && on('dungeons')) extra += `<div class="prompt">Is this a Dungeon? What's floor 1?</div>`;
  if (g.state === 'open' && !g.path) extra += `<div class="seg" style="margin-top:7px">${paths().map(p => `<button data-act="sortTo" data-id="${g.id}" data-p="${p}">${esc(pathName(p))}</button>`).join('')}</div>`;
  const canCheck = g.state === 'open' && g.path && !(g.raid && (g.floorIdx === 2 || g.floorIdx === 3) && !g.raid.grand);
  return `<div class="gate">${canCheck ? `<button class="check" data-act="clear" data-id="${g.id}" aria-label="Clear">✓</button>` : `<span style="width:26px"></span>`}
    <div class="main" data-act="gate" data-id="${g.id}"><div class="title">${esc(g.title)}</div><div class="meta">${meta}</div>${extra}</div></div>`;
}
function renderGates() {
  if (lateNight() && !showLate && !priv.dateOverride) {
    return `<div class="system"><div class="line">It's late. The gates will be here in the morning.</div>
      <p class="small" style="margin:8px 0">Anything on your mind can go in the Close the gates box on Today.</p>
      <button class="btn ghost small" data-act="showLate">Show anyway</button></div>`;
  }
  wakeWaiting();
  let h = `<div class="card"><div class="row" style="flex-wrap:nowrap"><input type="text" id="cap" placeholder="New gate: just a title" data-enter="capture">
    <button class="btn" data-act="capture">Add</button></div>
    <div class="row small muted" style="margin-top:8px"><button class="btn ghost small" data-act="captureMirage">It's a worry, not a task</button>
    <button class="btn ghost small" data-act="importOpen">Paste a list</button></div>
    <div class="small muted" style="margin-top:6px">Gate or Mirage? If there's a physical step you could start in under 2 minutes, it's a Gate.</div></div>`;

  h += mirageStrip();

  // On a heavy or low day, only what is due shows. The rest is still there, one tap away.
  const low = LOW[priv.low[today()]], quiet = low && low.gates && !showAllToday;
  const due = g => g.date && g.date <= today();
  const open = st.gates.filter(g => g.state === 'open' && (!quiet || due(g) || !g.path));
  if (quiet) h += `<div class="card small"><span class="muted">${esc(low.n)}: only gates due today are showing.</span> <button class="btn ghost small" data-act="showAll">Show all</button></div>`;
  const unsorted = open.filter(g => !g.path);
  const mine = open.filter(g => g.path && (!g.owner || g.owner === 'me'));
  const commanded = open.filter(g => g.path && g.owner && g.owner !== 'me');
  const waiting = st.gates.filter(g => g.state === 'waiting');
  const sealed = st.gates.filter(g => g.state === 'sealed');
  const done = st.gates.filter(g => g.state === 'done').sort((a, b) => (b.done > a.done ? 1 : -1)).slice(0, 10);

  if (unsorted.length) h += `<h2>Sort these</h2><div class="card">${unsorted.map(gateRow).join('')}</div>`;
  h += `<h2>Open gates</h2>`;
  if (!mine.length) h += `<div class="card muted">No open gates. That's allowed.</div>`;
  Object.keys(PATHS).forEach(p => {
    const list = mine.filter(g => g.path === p).sort((a, b) => (a.date || '9') < (b.date || '9') ? -1 : 1);
    if (list.length) h += `<div class="card"><h3>${esc(pathName(p))}</h3>${list.map(gateRow).join('')}</div>`;
  });
  if (commanded.length) h += `<h2>Commanded gates</h2><div class="small muted">What your guild is carrying for you.</div><div class="card">${commanded.map(gateRow).join('')}</div>`;
  if (waiting.length && on('waiting')) h += `<details class="card"><summary>${waiting.length} waiting, back on their dates</summary>${waiting.map(gateRow).join('')}</details>`;
  if (sealed.length) h += `<details class="card"><summary>${sealed.length} sealed gates</summary>${sealed.map(gateRow).join('')}</details>`;
  if (done.length) h += `<details class="card"><summary>Recently cleared</summary>${done.map(g => `<div class="gate"><span style="width:26px" class="gold">✓</span><div class="main" data-act="gate" data-id="${g.id}"><div class="title muted">${esc(g.title)}</div></div></div>`).join('')}</details>`;
  return h;
}
function mirageWindow() { const d = dow(today()); return priv.preview || mirageOpenNow || d === 0 || d === 3; }
function mirageStrip() {
  const open = st.mirages.filter(m => m.status === 'open');
  const therapy = st.mirages.filter(m => m.status === 'therapy');
  if (!on('mirages')) return open.length ? `<div class="card small muted">${open.length} Mirage${open.length > 1 ? 's' : ''} parked. They'll keep.</div>` : '';
  let h = '';
  if (!mirageWindow()) {
    if (open.length) h += `<div class="card small"><span class="muted">${open.length} Mirage${open.length > 1 ? 's are' : ' is'} waiting for the next window (Wednesday or Sunday). They'll keep.</span></div>`;
  } else if (open.length) {
    h += `<h2>Mirage window</h2><div class="small muted">10 minutes. Each one gets an exit.</div><div class="card">` + open.map(m => `
      <div class="gate" id="mir-${m.id}"><div class="main"><div class="title">${esc(m.text)}</div>
      ${m.returns >= 3 ? '<div class="prompt">This one keeps coming back. It might be one to take to therapy.</div>' : ''}
      <div class="row" style="margin-top:7px"><button class="btn small" data-act="mirGate" data-id="${m.id}">Becomes a Gate</button>
      <button class="btn small" data-act="mirLet" data-id="${m.id}">Let go</button>
      <button class="btn small" data-act="mirTherapy" data-id="${m.id}">Take to therapy</button>
      <button class="btn ghost small" data-act="mirBack" data-id="${m.id}">It came back</button></div></div></div>`).join('') + `</div>`;
  }
  if (therapy.length) h += `<details class="card"><summary>To bring to a session (${therapy.length})</summary>${therapy.map(m => `<div class="small" style="padding:6px 0">${esc(m.text)} <button class="btn ghost small" data-act="mirDone" data-id="${m.id}">Talked about it</button></div>`).join('')}</details>`;
  return h;
}

/* ---------------- Render: Week (Sunday review) ---------------- */
function renderWeek() {
  const w = wk(), t = today(), isSun = dow(t) === 0;
  const nextKey = isSun ? addDays(weekKey(t), 7) : weekKey(t);
  const nw = st.weeks[nextKey] || w;
  let h = `<div class="system"><div class="line">${on('review') ? 'Sunday review. 20 minutes. The System will do the sums.' : 'The weekly review starts when Season 1 opens.'}</div></div>`;
  if (!on('review')) return h;

  if (on('mana')) {
    h += `<h2>1. The coming week</h2><div class="card"><div class="small muted">How heavy is work going to be? This sets your Mana.</div>
      <div class="seg" style="margin-top:8px">${['light', 'normal', 'heavy'].map(x => `<button class="${(nw.type || 'normal') === x ? 'sel' : ''}" data-act="weekType" data-v="${x}" data-k="${nextKey}">${x[0].toUpperCase() + x.slice(1)} work week (${WEEK_MANA[x]})</button>`).join('')}</div>`;
    const prev = st.weeks[addDays(weekKey(t), -7)];
    const m = manaInfo();
    if (m.over && prev && prev.over) {
      h += `<div class="system" style="margin-top:10px"><div class="line">Fatigue warning. Mana ran over two weeks running.</div>
        <div class="row" style="margin-top:8px"><button class="btn gold small" data-act="fatigueYes" data-k="${nextKey}">Set next week 3 lower</button></div></div>`;
    }
    // Cycle look-ahead: if the PMS window or a period falls in the coming week, offer a lighter week.
    const c = phasesOn() ? cycleDay() : null, pat = cyclePattern();
    if (c && c.ph && !(nw.adjust < 0)) {
      const ws = isSun ? nextKey : addDays(weekKey(t), 0), we = addDays(ws, 6), pms = addDays(c.next, -5);
      if ((pms <= we && c.next >= ws) || (c.next >= ws && c.next <= we)) {
        h += `<div class="system" style="margin-top:10px"><div class="line">Your period is likely around ${nice(c.next)}. ${pat && pat.lower ? 'Your own mood checks show these days run lower for you.' : 'The days before it can feel heavier.'}</div>
          <div class="row" style="margin-top:8px"><button class="btn gold small" data-act="fatigueYes" data-k="${nextKey}">Plan a lighter week (3 lower)</button></div></div>`;
      }
    }
    h += `</div>`;
  }

  const held = w.holds || {};
  const yn = (key, label) => `<div class="spread" style="padding:6px 0"><span>${label}</span><div class="seg">
    ${['yes', 'n/a', 'no'].map(v => `<button class="${(w.holdAns || {})[key] === v ? 'sel' : ''}" data-act="holdAns" data-key="${key}" data-v="${v}">${v}</button>`).join('')}</div></div>`;
  const hasWork = paths().includes('work');
  h += `<h2>2. Holding the line</h2><div class="card">${hasWork ? `<h3>${esc(pathName('work'))}</h3>
    ${yn('w1', 'Asked for what you needed (help, time, feedback)')}
    ${yn('w2', 'No commitment missed without renegotiating it')}
    ${yn('w3', 'Your next-step Dungeon got touched, if you have one')}` : ''}
    <h3 style="margin-top:12px">${esc(pathName('life'))}</h3>
    ${yn('l1', 'One friend or family contact, or one creative or reading block')}
    <div class="small muted" style="margin-top:8px">A Path that holds the line can't lose rank. A "no" just gets one question.</div></div>`;

  const stale = st.gates.filter(g => g.state === 'open' && daysBetween(g.touched, t) >= 21);
  if (stale.length) {
    h += `<h2>3. Gates nobody has touched in 3 weeks</h2><div class="card">${stale.map(g => `<div class="gate"><div class="main"><div class="title">${esc(g.title)}</div>
      <div class="row" style="margin-top:6px"><button class="btn small" data-act="staleReal" data-id="${g.id}">Still real</button>
      <button class="btn small" data-act="staleSeal" data-id="${g.id}">Seal it</button>${g.floors ? '' : `<button class="btn small" data-act="avoidStale" data-id="${g.id}">I've been avoiding it</button>`}<button class="btn ghost small" data-act="staleDrop" data-id="${g.id}">Drop it</button></div></div></div>`).join('')}</div>`;
  }

  const open = st.mirages.filter(m => m.status === 'open');
  if (open.length && on('mirages')) h += `<h2>Mirage window</h2><div class="card"><button class="btn" data-act="mirOpen">Open the window (${open.length})</button></div>`;

  h += `<div class="card" style="margin-top:18px">${w.reviewed ? '<div class="gold">Review done for this week.</div>' : '<button class="btn gold" data-act="finishReview">Finish review</button>'}</div>`;

  if (st.flags.oneThing) h += `<div class="small muted">Last "one thing": ${esc(st.flags.oneThing)}</div>`;

  // Your own evidence: action tends to come before motivation, and this shows whether it does for you.
  const f = x => x.toFixed(1), links = [['moved', r => !!r.move], ['did a small good thing', r => !!r.good]]
    .map(([t, fn]) => [t, moodLink(fn)]).filter(x => x[1]);
  const cp = cyclePattern();
  if (links.length || cp) {
    h += `<h2>What your last weeks show</h2><div class="card">`;
    h += links.map(([t, L]) => `<div class="small" style="padding:4px 0">On days you ${t}, your mood averaged <b>${f(L.yes)}</b>. On other days, <b>${f(L.no)}</b>.</div>`).join('');
    if (cp) h += `<div class="small" style="padding:4px 0">${cp.lower ? `Your mood tends to dip before and at the start of your period (<b>${f(cp.pre)}</b> against <b>${f(cp.rest)}</b> on other days). It's a pattern, not a failing. The review will offer lighter weeks then.` : `Your mood doesn't dip much around your period (<b>${f(cp.pre)}</b> against <b>${f(cp.rest)}</b>).`}</div>`;
    h += `<div class="small muted" style="margin-top:6px">From your mood checks only. A pattern, not proof.</div></div>`;
  }
  if (st.hostName) h += `<h2>${esc(st.hostName)}</h2><div class="card"><div class="spread"><span class="small muted">Turn on the regular session once its first-session Dungeon is cleared.</span>
    <button class="btn small ${st.flags.wbActive ? 'on' : ''}" data-act="wbToggle">${st.flags.wbActive ? 'On' : 'Off'}</button></div></div>`;
  return h;
}

/* ---------------- Render: Status ---------------- */
function renderStatus() {
  const L = levelInfo(), su = shownUp(), m = manaInfo();
  let h = `<div class="system"><div class="line">STATUS</div>
    <div class="stat" style="margin-top:10px">
      <span class="k">Name</span><span>${esc(st.name || 'Player')}</span>
      <span class="k">Level</span><span>${L.l} · Rank ${playerRank(L.l)}</span>
      <span class="k">Class</span><span>${esc(st.cls)}</span>
      <span class="k">Title</span><span>${st.equipped && on('titles') ? esc(TITLES[st.equipped]) : 'None'}</span>
      <span class="k">Shown up</span><span>${su.n} of the last ${su.d} days</span>
      ${on('mana') ? `<span class="k">Mana</span><span>${m.used} of ${m.total}</span>` : ''}
    </div>
    <div class="small muted" style="margin-top:10px">XP to Level ${L.l + 1}: ${L.rem} / ${L.need}</div>
    <div class="bar" style="margin-top:5px"><i style="width:${Math.round(L.rem / L.need * 100)}%"></i></div>
    <div class="small muted" style="margin-top:6px">Today: ${st.xpLog[today()] || 0} of ${CAP} XP. Past that is overtime.</div></div>`;

  h += `<h2>Paths</h2>`;
  paths().forEach(p => {
    const items = trialItems(p), ready = trialReady(p);
    const focus = p === 'body' || p === 'mind' ? 'Main Quest' : p === 'guild' ? 'Side Quest' : 'Holding the line';
    h += `<div class="card"><div class="spread"><div class="row">${pathChip(p)}<span class="chip gold">Rank ${st.ranks[p]}</span></div><span class="small muted">${focus}</span></div>`;
    if (p === 'body') h += `<div class="small muted" style="margin-top:6px">Starting level: ${esc((LEVELS[st.level] || LEVELS.zero).n)}</div>`;
    if (on('trials')) {
      h += items.length ? `<div class="small muted" style="margin:10px 0 4px">Path Trial to Rank ${RANKS[RANKS.indexOf(st.ranks[p]) + 1]}</div>` + items.map(it => `
        <div class="spread small" style="padding:5px 0"><span>${it.done ? '<span class="gold">✓</span> ' : ''}${esc(it.t)}</span>
        ${it.auto ? `<span class="chip">${it.n} / ${it.of}</span>` : `<button class="btn small ${it.done ? 'on' : ''}" data-act="tick" data-p="${p}" data-i="${it.i}">${it.done ? 'Done' : 'Mark done'}</button>`}</div>`).join('')
        : '<div class="small muted" style="margin-top:8px">The next trials get written at the Season review.</div>';
      if (ready) h += `<button class="btn gold" style="margin-top:8px" data-act="clearTrial" data-p="${p}">Clear the Path Trial</button>`;
      if (p === 'mind') h += `<div class="small muted" style="margin-top:8px">Mind rank never goes down. Its stages are skills you keep: Notice, Regulate, Get support, Prevent, Steady.</div>`;
    } else h += `<div class="small muted" style="margin-top:8px">Path Trials appear in week 3 of Season 1. Their counts start on ${nice(cal().s1Start)}.</div>`;
    h += `</div>`;
  });

  if (on('shadows')) {
    const ready = DAILY.filter(q => shadowReady(q.id));
    const army = Object.entries(st.shadows);
    h += `<h2>Shadow Army</h2><div class="card">`;
    h += ready.map(q => `<div class="system"><div class="line">${esc(q.t)} has held for 30 days. Extract it?</div>
      <button class="btn gold small" style="margin-top:8px" data-act="arise" data-id="${q.id}">ARISE</button></div>`).join('');
    h += army.length ? army.map(([id, s]) => `<div class="spread" style="padding:6px 0"><span><b class="gold">${esc(s.name)}</b> <span class="muted small">carries ${esc(DAILY.find(q => q.id === id).t.toLowerCase())}</span></span><span class="small muted">since ${nice(s.date)}</span></div>`).join('')
      : (ready.length ? '' : '<div class="small muted">Your first Shadow can rise once a daily item has held on 24 of 30 days. Its name is waiting: Igris.</div>');
    h += `</div>`;
  }
  if (on('titles') && st.titles.length) {
    h += `<h2>Titles</h2><div class="card"><div class="row">${st.titles.map(t => `<button class="btn small ${st.equipped === t ? 'on' : ''}" data-act="equip" data-t="${t}">${esc(TITLES[t])}</button>`).join('')}</div></div>`;
  }
  if (on('chests') && st.chests.length) {
    h += `<h2>Reward chests</h2><div class="card">${st.chests.map(c => `<div class="small" style="padding:4px 0"><span class="gold">◆</span> ${esc(c.item)} <span class="muted">· ${nice(c.date)}</span></div>`).join('')}</div>`;
  }
  if (on('eras') && st.trialLog.length) {
    h += `<h2>Era tracklist</h2><div class="card">${st.trialLog.map((x, i) => `<div class="small" style="padding:3px 0"><span class="muted">${i + 1}.</span> ${esc(pathName(x.p))}: Rank ${x.to} <span class="muted">· ${nice(x.date)}</span></div>`).join('')}</div>`;
  }
  return h + footerLinks();
}

/* ---------------- Sheets ---------------- */
function sheetMind() {
  const cur = priv.mind[today()] || {};
  openSheet(`<h3>How are you, honestly?</h3>
    <div class="mood" style="margin-top:10px">${MOODS.map(([n, w]) => `<button class="${cur.s === n ? 'sel' : ''}" data-act="moodPick" data-n="${n}"><span>${n}</span>${w}</button>`).join('')}</div>
    <label class="f">One line, if you want</label><input type="text" id="mline" value="${esc(cur.line || '')}" placeholder="Optional">
    <label class="row small" style="margin-top:10px"><input type="checkbox" id="mcalm" ${cur.calm ? 'checked' : ''}> I used a calming tool today (breathing, a walk, Spiral Breaker)</label>
    <div class="small muted" style="margin-top:8px">This stays on this phone. The line is deleted after 14 days. The 1 to 5 number is kept for 90 days so your own patterns can show.</div>
    <div class="row" style="margin-top:14px"><button class="btn gold" data-act="moodSave">Save</button><button class="btn ghost" data-act="closeSheet">Cancel</button></div>`);
  el('sheet').dataset.mood = cur.s || '';
}
function sheetClose() {
  openSheet(`<h3>Close the gates</h3><div class="small muted">Type anything still open in your head, one per line. The list stays hidden tonight. It gets sorted in the morning.</div>
    <textarea id="closeTxt" style="margin-top:10px" placeholder="One per line"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn gold" data-act="closeSave">Close the gates</button><button class="btn ghost" data-act="closeMin">Just tap: gates closed</button></div>`);
}
function sheetGate(id) {
  const g = findGate(id); if (!g) return;
  const seg = (name, opts, cur, labels) => `<div class="seg">${opts.map((o, i) => `<button class="${cur === o ? 'sel' : ''}" data-act="gset" data-id="${g.id}" data-f="${name}" data-v="${o}">${labels ? labels[i] : o}</button>`).join('')}</div>`;
  let floorsHtml = '';
  if (g.floors) {
    floorsHtml = `<label class="f">${g.raid ? 'Raid floors' : 'Floors'}</label>` + g.floors.map((f, i) => `<div class="small" style="padding:3px 0">${i < g.floorIdx ? '<span class="gold">✓</span>' : i === g.floorIdx ? '<span style="color:var(--sys)">›</span>' : '<span class="muted">·</span>'} ${esc(f.t)}${g.raid && g.raid.skipped[i] ? ' <span class="muted">(skipped)</span>' : ''}</div>`).join('');
    if (g.state === 'open' && g.floorIdx < g.floors.length) {
      const i = g.floorIdx;
      if (g.raid && i === 2) floorsHtml += `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><div style="flex:1"><label class="f">Total costs (Rs)</label><input type="number" id="rcost" value="${esc(g.raid.costs)}"></div>
        <div style="flex:1"><label class="f">Ticket price (Rs)</label><input type="number" id="rprice" value="${esc(g.raid.price)}"></div></div>
        <div class="small gold" id="rbe" style="margin-top:6px">${breakEven(g.raid) ? 'Break-even: ' + breakEven(g.raid) + ' tickets' : ''}</div>`;
      if (g.raid && i === 3) floorsHtml += `<label class="f">Owner besides you</label><input type="text" id="rowner" value="${esc(g.raid.owner)}" placeholder="A teammate's name">`;
      if (g.raid && i === 7) floorsHtml += `<div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">Tickets sold</label><input type="number" id="rsold" value="${esc(g.raid.sold)}"></div>
        <div style="flex:1"><label class="f">Total spent (Rs)</label><input type="number" id="rspent" value="${esc(g.raid.spent || g.raid.costs)}"></div>
        <div style="flex:1"><label class="f">Of which ads (Rs)</label><input type="number" id="rad" value="${esc(g.raid.ad)}"></div></div>`;
      floorsHtml += `<div class="row" style="margin-top:10px"><button class="btn gold small" data-act="floor" data-id="${g.id}">Clear floor: ${esc(g.floors[i].t)}</button>
        ${g.raid && g.raid.grand && (i === 2 || i === 3) ? `<button class="btn ghost small" data-act="floorSkip" data-id="${g.id}">Skip (grandfathered)</button>` : ''}
        ${g.builtin === 'support' && i >= 2 ? `<button class="btn ghost small" data-act="resched" data-id="${g.id}">I rescheduled</button>` : ''}</div>`;
      if (!g.raid) floorsHtml += `<div class="row" style="margin-top:8px;flex-wrap:nowrap"><input type="text" id="newFloor" placeholder="Add a floor"><button class="btn small" data-act="addFloor" data-id="${g.id}">Add</button></div>`;
    }
    if (g.raid) {
      const be = g.raid.be || breakEven(g.raid), sold = Number(g.raid.sold) || 0;
      if (be) {
        const max = Math.max(be, sold) * 1.15;
        floorsHtml += `<label class="f">Loot: tickets sold against break-even (${be})</label><div class="loot"><i style="width:${Math.min(100, sold / max * 100)}%"></i><b style="left:${be / max * 100}%"></b></div>`;
        if (g.raid.sold) {
          const price = Number(g.raid.price), spent = Number(g.raid.spent || g.raid.costs) || 0, ad = Number(g.raid.ad) || 0;
          const res = sold * price - spent;
          floorsHtml += `<div class="small">${sold} sold · result Rs ${res.toLocaleString('en-IN')} · ${sold && ad ? 'ad cost per ticket Rs ' + Math.round(ad / sold) : 'no ad spend logged'}</div>`;
        }
      }
    }
  }
  openSheet(`<label class="f">Gate</label><input type="text" id="gtitle" value="${esc(g.title)}">
    <label class="f">Path</label>${seg('path', paths(), g.path, paths().map(p => esc(pathName(p))))}
    <label class="f">Size</label>${seg('size', ['E', 'D', 'C', 'B'], g.size, ['E · small', 'D', 'C', 'B · big'])}
    ${g.floors ? '' : `<label class="f">Repeats</label>${seg('repeat', ['', 'daily', 'weekly'], g.repeat || '', ['One-off', 'Every day', 'Every week'])}`}
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">Date (optional)</label><input type="date" id="gdate" value="${esc(g.date)}"></div>
    <div style="flex:1"><label class="f">Owner</label><input type="text" id="gowner" value="${esc(g.owner === 'me' ? '' : g.owner)}" placeholder="You"></div></div>
    ${floorsHtml}
    <div class="row" style="margin-top:16px"><button class="btn gold" data-act="gsave" data-id="${g.id}">Save</button>
    ${g.state === 'open' && !g.floors ? `<button class="btn gold small" data-act="avoidOpen" data-id="${g.id}">I've been avoiding this</button>` : ''}
    ${g.state === 'open' && !g.floors && on('dungeons') ? `<button class="btn small" data-act="mkDungeon" data-id="${g.id}">Make it a Dungeon</button>` : ''}
    ${g.state === 'open' && !g.floors ? `<button class="btn small" data-act="mkRaid" data-id="${g.id}">Make it a Raid</button>` : ''}
    ${g.state === 'open' && on('waiting') ? `<button class="btn small" data-act="waitOpen" data-id="${g.id}">Waiting on someone</button>` : ''}
    ${g.state === 'open' ? `<button class="btn small" data-act="handOpen" data-id="${g.id}">Hand off</button><button class="btn small" data-act="shrink" data-id="${g.id}">Shrink</button>` : ''}
    ${g.state === 'open' ? `<button class="btn ghost small" data-act="seal" data-id="${g.id}">Seal</button>` : g.state !== 'done' ? `<button class="btn ghost small" data-act="unseal" data-id="${g.id}">Open again</button>` : ''}
    ${g.builtin ? '' : `<button class="btn ghost small" data-act="drop" data-id="${g.id}">Drop</button>`}</div>
    <div id="subform"></div>`);
}
function sheetImport() {
  openSheet(`<h3>Paste a list</h3><div class="small muted">One item per line: Title | Path | Size | Date | Owner | Type. Only the title is needed. Anything already in your gates is left out.
    Paths: ${paths().map(p => esc(pathName(p).toLowerCase())).join(', ')}. Types: gate, daily, weekly, mirage, raid, raid grandfathered, dungeon, waiting, sealed.</div>
    <textarea id="impTxt" style="margin-top:10px;min-height:140px" placeholder="Office training | work | D | 2026-10-30 | me | gate"></textarea>
    <div class="row" style="margin-top:12px"><button class="btn gold" data-act="impPreview">Check it</button><button class="btn ghost" data-act="closeSheet">Cancel</button></div>
    <div id="impOut"></div>`);
}
let pendingImport = [];
function parseImport(txt) {
  return txt.split(/\n/).map(l => l.trim().replace(/^\|/, '').replace(/\|$/, '').trim())
    .filter(l => l && !/^title\s*[|\t]/i.test(l) && !/^[-:|\s\t]+$/.test(l))
    .map(l => {
      const c = l.split(/\s*[|\t]\s*/);
      const [title, path, size, date, owner, type] = c.map(x => (x || '').trim());
      const flags = [];
      const pl = (path || '').toLowerCase();
      const p = PATHS[pl] ? pl : Object.keys(st.pathNames).find(k => norm(st.pathNames[k]) === norm(pl)) || null;
      if (!p && (type || '').toLowerCase() !== 'mirage') flags.push('Path?');
      const s = ['E', 'D', 'C', 'B'].includes((size || '').toUpperCase()) ? size.toUpperCase() : 'E';
      let d = '';
      if (date && date !== '-') { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) d = date; else flags.push('Date?'); }
      const ty = (type || 'gate').toLowerCase();
      const dupe = st.gates.some(g => g.state !== 'done' && norm(g.title) === norm(title)) || st.mirages.some(m => m.status === 'open' && norm(m.text) === norm(title));
      if (dupe) flags.push('Already in your gates, left out');
      return { title, path: p, size: s, date: d, owner: owner && owner.toLowerCase() !== 'me' && owner !== '-' ? owner : 'me', type: ty, flags, keep: !dupe };
    }).filter(r => r.title);
}

/* ---------------- Onboarding ---------------- */
// Setup fields, shared by the first screen and Settings.
function setupFields() {
  const lv = Object.entries(LEVELS).map(([k, L]) => `<label class="row" style="padding:5px 0;flex-wrap:nowrap;align-items:flex-start"><input type="radio" name="lvl" value="${k}" ${st.level === k ? 'checked' : ''}>
    <span><b>${esc(L.n)}</b><br><span class="small muted">${esc(L.d)}. Daily move: ${esc(L.move[0].toLowerCase())}</span></span></label>`).join('');
  const area = (p, hint) => `<div class="row" style="flex-wrap:nowrap;margin-top:6px"><input type="checkbox" id="on_${p}" ${st.hidden.includes(p) ? '' : 'checked'}>
    <input type="text" id="nm_${p}" value="${esc(st.pathNames[p] || '')}" placeholder="${esc(hint)}"></div>`;
  const cy = priv.cycle, last = cy.starts.slice().sort().pop() || '';
  return `<label class="f">What should the System call you?</label><input type="text" id="suName" value="${esc(st.name)}" placeholder="Player">
    <label class="f">Where are you starting from?</label>${lv}
    <label class="f">Season 1 starts on (8 weeks; a Monday works best)</label><input type="date" id="suStart" value="${esc(st.seasonStart || nextMonday(today()))}">
    <label class="f">Your areas. Body, Mind and Life are always on. Untick what doesn't apply, and rename if you like.</label>
    ${area('work', 'Work (or study)')}${area('guild', 'Guild (a community or project you run)')}
    <label class="f">A regular session you host (optional)</label><input type="text" id="suHost" value="${esc(st.hostName)}" placeholder="Leave empty if none">
    <label class="row small" style="margin-top:10px"><input type="checkbox" id="suSupport" ${st.support ? 'checked' : ''}> Add a Dungeon for finding support, like a therapist or coach</label>
    <h3 style="margin-top:18px">Cycle (optional)</h3>
    <label class="row small"><input type="checkbox" id="cyOn" ${cy.on ? 'checked' : ''}> Show my cycle phase and adjust the plan around it</label>
    <label class="row small" style="margin-top:6px"><input type="checkbox" id="cyHorm" ${cy.hormonal ? 'checked' : ''}> I use hormonal contraception (pill, patch, ring, implant, hormonal IUD). Phase tips switch off; period logging stays.</label>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1"><label class="f">First day of last period</label><input type="date" id="cyLast" value="${esc(last)}"></div>
    <div style="flex:1"><label class="f">Usual cycle (days)</label><input type="number" id="cyLen" min="20" max="45" value="${esc(cy.len)}"></div>
    <div style="flex:1"><label class="f">Period (days)</label><input type="number" id="cyPlen" min="2" max="10" value="${esc(cy.plen)}"></div></div>
    <div class="small muted" style="margin-top:6px">Estimates only. Not for contraception and not medical advice. After a few periods, the app uses your own average.</div>
    <label class="f">Your birthday (optional, the System leaves you alone that day)</label><input type="date" id="suBday" value="${esc(priv.birthday)}">`;
}
function readSetup() {
  const r = document.querySelector('input[name="lvl"]:checked');
  st.name = val('suName'); st.level = r ? r.value : 'zero';
  st.seasonStart = val('suStart') || nextMonday(today());
  HIDEABLE.forEach(p => {
    const on = el('on_' + p).checked; st.hidden = st.hidden.filter(x => x !== p); if (!on) st.hidden.push(p);
    const nm = val('nm_' + p); if (nm) st.pathNames[p] = nm; else delete st.pathNames[p];
  });
  st.hostName = val('suHost');
  const wantSupport = el('suSupport').checked;
  if (wantSupport && !st.gates.some(g => g.builtin === 'support')) newGate({ title: 'Support Dungeon', path: 'mind', size: 'C', builtin: 'support', floors: SUPPORT_FLOORS.map(t => ({ t, done: '' })) });
  if (!wantSupport) st.gates = st.gates.filter(g => g.builtin !== 'support' || g.floorIdx > 0);
  st.support = wantSupport;
  const cy = priv.cycle; cy.on = el('cyOn').checked; cy.hormonal = el('cyHorm').checked;
  cy.len = Math.min(45, Math.max(20, Number(val('cyLen')) || 28)); cy.plen = Math.min(10, Math.max(2, Number(val('cyPlen')) || 5));
  const last = val('cyLast'); if (last && !cy.starts.includes(last)) cy.starts.push(last);
  priv.birthday = val('suBday');
}
function onboarding() {
  el('view').innerHTML = `<div class="system" style="margin-top:30px"><div class="line">You have been chosen as a Player. Do you accept?</div>
    <p class="small" style="margin:12px 0 0">Everything you put in here stays on this phone. Nothing is sent anywhere. You can change all of it later in Settings.</p></div>
    <div class="card">${setupFields()}</div>
    <button class="btn gold" data-act="accept" style="width:100%;padding:12px">Accept</button>`;
}

/* ---------------- Settings ---------------- */
function sheetSettings() {
  const q = id => DAILY.find(x => x.id === id), dqRow = id => { const t = dq(q(id)); return `<label class="f">${esc(q(id).t)}</label>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="dqf_${id}" value="${esc(t.full)}"><input type="text" id="dqm_${id}" value="${esc(t.min)}" placeholder="Minimum"></div>`; };
  const ps = st.plannedSafe.map((r, i) => `<div class="spread small" style="padding:4px 0"><span>${nice(r.from)} to ${nice(r.to)}</span><button class="btn ghost small" data-act="psDel" data-i="${i}">Remove</button></div>`).join('');
  openSheet(`<h3>Settings</h3>
    ${setupFields()}
    <h3 style="margin-top:18px">Daily Quest wording</h3><div class="small muted">Full version, then the minimum. Change it to fit your life.</div>
    ${['night', 'move', 'fuel'].map(dqRow).join('')}
    <h3 style="margin-top:18px">Safe Zone days ahead</h3><div class="small muted">Leave, travel or anything planned. Quests pause and those days don't count.</div>
    ${ps}<div class="row" style="flex-wrap:nowrap;margin-top:6px"><input type="date" id="psFrom"><input type="date" id="psTo"><button class="btn small" data-act="psAdd">Add</button></div>
    <label class="f">Small good things to pick from (one per line)</label><textarea id="sGood">${esc(st.goodList.join('\n'))}</textarea>
    <label class="f">Reward chest items (one per line)</label><textarea id="sRewards">${esc(st.rewards.join('\n'))}</textarea>
    <label class="row" style="margin-top:12px"><input type="checkbox" id="sSound" ${priv.sound ? 'checked' : ''}> Sound (always off after 10 pm, except the close-the-gates hum)</label>
    <h3 style="margin-top:18px">Trying it out</h3>
    <label class="row"><input type="checkbox" id="sPreview" ${priv.preview ? 'checked' : ''}> Show everything now (normally features switch on week by week)</label>
    <label class="f">Pretend today is (leave empty for the real date)</label><input type="date" id="sDate" value="${esc(priv.dateOverride)}">
    <div class="row" style="margin-top:16px"><button class="btn gold" data-act="settingsSave">Save</button><button class="btn ghost" data-act="closeSheet">Close</button></div>
    <h3 style="margin-top:22px">Backup</h3><div class="small muted">The backup has your gates, setup and progress. Mind checks, low-energy reasons and cycle data are never in it.</div>
    <div class="row" style="margin-top:8px"><button class="btn small" data-act="export">Download backup</button><label class="btn small">Restore<input type="file" id="restore" accept="application/json" hidden></label></div>
    <div class="row" style="margin-top:22px"><button class="btn ghost small" data-act="wipe">Start over (deletes everything here)</button></div>`);
  setTimeout(() => { const r = el('restore'); if (r) r.onchange = restore; }, 0);
}
function restore(e) {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => { try { const v = JSON.parse(rd.result); if (!v || v.v !== 1) throw 0; st = Object.assign(freshState(), v); save(); closeSheet(); render(); sys('Backup restored.'); } catch (x) { sys('That file is not an ARISE backup.'); } };
  rd.readAsText(f);
}

/* ---------------- Actions ---------------- */
const ACT = {
  tab: d => { tab = d.tab; showLate = false; render(); window.scrollTo(0, 0); },
  settings: () => sheetSettings(),
  closeSheet: () => closeSheet(),
  sheet: d => d.s === 'mind' ? sheetMind() : sheetClose(),
  accept: () => {
    readSetup();
    st.onboarded = true; st.created = today(); st.lastBackup = today();
    save(); render(); sys('Player registered. Welcome, ' + (st.name || 'Player') + '.', 'gold'); sound('ring');
  },
  lowOpen: () => openSheet(`<h3>What's making today hard?</h3><div class="small muted">Pick the closest one. Today's quest changes to fit it. This stays on this phone and is deleted after 14 days.</div>
    <div class="row" style="margin-top:12px">${Object.entries(LOW).map(([k, L]) => `<button class="btn ${priv.low[today()] === k ? 'on' : ''}" data-act="lowPick" data-r="${k}">${esc(L.n)}</button>`).join('')}</div>
    <div class="row" style="margin-top:14px"><button class="btn ghost" data-act="closeSheet">Cancel</button></div>`),
  lowPick: d => {
    const t = today(); ACT.lowClear(true);
    priv.low[t] = d.r;
    if (LOW[d.r].pause && !st.safe.days.includes(t)) st.safe.days.push(t);   // unwell: the day is paused and never counts against you
    if (d.r === 'period' && priv.cycle.on) { const c = cycleDay(); if (!c || c.ph !== 'menstrual') { priv.cycle.starts.push(t); sys('Period start logged for today. Change it in Settings if that is wrong.'); } }
    showAllToday = false; closeSheet(); save(); render();
  },
  lowClear: quiet => {
    const t = today();
    if (priv.low[t] && LOW[priv.low[t]].pause && !st.safe.active) st.safe.days = st.safe.days.filter(k => k !== t);
    delete priv.low[t];
    if (quiet !== true) { save(); render(); }
  },
  showAll: () => { showAllToday = true; render(); },
  goodPick: d => {
    const r = dayRec(); if (!r.good) { r.xp.good = award(SIZE_XP.E); sound('chime'); }
    r.good = st.goodList[Number(d.i)]; save(); render(); sys('A small good thing. The System noticed.');
  },
  goodUndo: () => { const r = dayRec(); unaward(r.xp.good || 0); delete r.good; delete r.xp.good; save(); render(); },
  periodStart: () => {
    const t = today(); if (!priv.cycle.starts.includes(t)) priv.cycle.starts.push(t);
    save(); render(); sys('Period start logged. The System will plan around it.');
  },
  nudgeLater: () => { st.nudged = weekKey(today()); save(); render(); },
  psAdd: () => {
    const f = val('psFrom'), to = val('psTo') || f; if (!f) return sys('Pick the first day.');
    ACT.settingsRead(); st.plannedSafe.push({ from: f < to ? f : to, to: f < to ? to : f }); save(); sheetSettings();
  },
  psDel: d => { ACT.settingsRead(); st.plannedSafe.splice(Number(d.i), 1); save(); sheetSettings(); },
  daily: d => {
    const r = dayRec(), q = DAILY.find(x => x.id === d.id);
    if (r[d.id] === d.m) { unaward(r.xp[d.id] || 0); delete r[d.id]; delete r.xp[d.id]; }
    else { if (!r[d.id]) { r.xp[d.id] = award(SIZE_XP.E, { bonus: q.main && inSeason() }); sound('chime'); } r[d.id] = d.m; }
    checkTitles(); save(); render();
  },
  moodPick: (d, b) => { el('sheet').dataset.mood = d.n; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('sel', x === b)); },
  moodSave: () => {
    const s = Number(el('sheet').dataset.mood); if (!s) return sys('Pick how you feel first. Any answer is fine.');
    const calm = el('mcalm').checked, prev = priv.mind[today()];
    if (calm && !(prev && prev.calm)) st.calm++;
    priv.mind[today()] = { s, line: val('mline'), calm }; priv.moodLog[today()] = s;
    const r = dayRec(); if (!r.mind) { r.mind = 'full'; r.xp.mind = award(SIZE_XP.E, { bonus: inSeason() }); }
    pruneMind(); closeSheet(); checkTitles(); save(); render();
    const c = phasesOn() ? cycleDay() : null;
    if (s <= 2 && c && c.ph === 'late') setTimeout(() => sys('This may be your cycle as well as your day. It usually lifts a few days into your period.'), 600);
  },
  closeSave: () => {
    const lines = val('closeTxt').split('\n').map(x => x.trim()).filter(Boolean);
    lines.forEach(t => newGate({ title: t, night: true }));
    ACT.closeMin(lines.length);
  },
  closeMin: n => {
    const r = dayRec(); if (!r.gates) { r.gates = typeof n === 'number' && n ? 'full' : 'min'; r.xp.gates = award(SIZE_XP.E); st.flags.closed = (st.flags.closed || 0) + 1; }
    closeSheet(); sys('All gates are closed. The Player may rest.'); sound('hum'); checkTitles(); save(); render();
  },
  rest: () => { award(SIZE_XP.D, { bonus: inSeason() }); st.flags.rested = true; sys('Rest logged. The System approves.'); checkTitles(); save(); render(); },
  ritual: d => {
    const w = wk(); w.rituals[d.id] = !w.rituals[d.id];
    if (w.rituals[d.id]) { award(d.id === 'joy' ? SIZE_XP.E : SIZE_XP.D); sound('chime'); }
    if (d.id === 'friend' || d.id === 'joy') { w.holdAns = w.holdAns || {}; if (w.rituals.friend || w.rituals.joy) w.holdAns.l1 = 'yes'; }
    save(); render();
  },
  returnDo: () => { st.returnDone[today()] = true; st.flags.returned = true; award(SIZE_XP.E); sys('Welcome back, ' + (st.name || 'Player') + '. No penalty has been applied.'); checkTitles(); save(); render(); },
  returnSkip: () => { st.returnDone[today()] = true; save(); render(); },
  safeOn: () => { st.safe.active = true; if (!st.safe.days.includes(today())) st.safe.days.push(today()); save(); render(); sys('You are inside the borders. Nothing follows you in.'); },
  ready: () => { st.safe.active = false; st.safe.days = st.safe.days.filter(k => k !== today()); save(); render(); sys('Welcome back, ' + (st.name || 'Player') + '.'); },
  showLate: () => { showLate = true; render(); },
  capture: () => { const t = val('cap'); if (!t) return; newGate({ title: t }); save(); render(); sys('Gate registered. It will wait for you.'); sound('chime'); setTimeout(() => el('cap') && el('cap').focus(), 0); },
  captureMirage: () => { const t = val('cap'); if (!t) return sys('Type the worry in the box first.'); st.mirages.push({ id: 'm' + (st.seq++), text: t, created: today(), returns: 0, status: 'open' }); save(); render(); sys('Mirage noted. It will wait for the next window.'); },
  importOpen: () => sheetImport(),
  impPreview: () => {
    pendingImport = parseImport(val('impTxt'));
    if (!pendingImport.length) return (el('impOut').innerHTML = '<p class="small muted">Nothing to import.</p>');
    el('impOut').innerHTML = `<table class="imp" style="margin-top:12px"><tr><th></th><th>Item</th><th>Path</th><th>Size</th><th>Date</th><th>Type</th></tr>
      ${pendingImport.map((r, i) => `<tr><td><input type="checkbox" data-imp="${i}" ${r.keep ? 'checked' : ''}></td><td>${esc(r.title)}${r.owner !== 'me' ? ' <span class="muted">(' + esc(r.owner) + ')</span>' : ''}${r.flags.length ? `<div class="flag">${r.flags.join(' · ')}</div>` : ''}</td>
      <td>${r.path ? esc(pathName(r.path)) : '?'}</td><td>${r.size}</td><td>${r.date ? nice(r.date) : ''}</td><td>${esc(r.type)}</td></tr>`).join('')}</table>
      <button class="btn gold" style="margin-top:12px" data-act="impAccept">Accept the ticked ones</button>`;
  },
  impAccept: () => {
    document.querySelectorAll('[data-imp]').forEach(c => { pendingImport[Number(c.dataset.imp)].keep = c.checked; });
    let n = 0;
    pendingImport.filter(r => r.keep).forEach(r => {
      n++;
      if (r.type === 'mirage') return st.mirages.push({ id: 'm' + (st.seq++), text: r.title, created: today(), returns: 0, status: 'open' });
      const g = newGate({ title: r.title, path: r.path, size: r.size, date: r.date, owner: r.owner });
      if (r.type.startsWith('raid')) makeRaid(g, r.type.includes('grand'));
      else if (r.type === 'dungeon') g.floors = [{ t: 'Decide floor 1', done: '' }];
      else if (r.type === 'sealed') g.state = 'sealed';
      else if (r.type === 'waiting') { g.state = 'waiting'; g.checkBack = r.date || addDays(today(), 3); g.date = ''; }
      else if (r.type === 'daily' || r.type === 'weekly') g.repeat = r.type;
    });
    pendingImport = []; closeSheet(); save(); render(); sys(n + ' gates registered. They will wait for you.');
  },
  clear: d => { const g = findGate(d.id); if (g) { clearGate(g); g.back = false; save(); render(); } },
  gate: d => sheetGate(d.id),
  sortTo: d => { const g = findGate(d.id); g.path = d.p; g.night = false; g.touched = today(); save(); render(); },
  gset: d => { const g = findGate(d.id); g[d.f] = d.v; g.touched = today(); saveGateFields(g); save(); sheetGate(g.id); },
  gsave: d => { const g = findGate(d.id); saveGateFields(g); save(); closeSheet(); render(); },
  floor: d => { const g = findGate(d.id); saveGateFields(g); clearFloor(g); save(); render(); if (g.state === 'open') sheetGate(g.id); else closeSheet(); },
  floorSkip: d => { const g = findGate(d.id); clearFloor(g, true); save(); render(); sheetGate(g.id); },
  resched: d => { const g = findGate(d.id); g.touched = today(); award(SIZE_XP.E, { bonus: inSeason() }); sys('Rescheduled. That still counts.'); save(); render(); sheetGate(g.id); },
  addFloor: d => { const g = findGate(d.id); const t = val('newFloor'); if (!t) return; g.floors.push({ t, done: '' }); save(); sheetGate(g.id); },
  mkDungeon: d => {
    const g = findGate(d.id);
    el('subform').innerHTML = `<label class="f">What's floor 1?</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="f1" placeholder="The first small step"><button class="btn small" data-act="mkDungeonGo" data-id="${g.id}">Go</button></div>`;
  },
  mkDungeonGo: d => { const g = findGate(d.id); const t = val('f1'); if (!t) return; saveGateFields(g); g.floors = [{ t, done: '' }]; g.floorIdx = 0; save(); render(); sheetGate(g.id); },
  avoidOpen: d => {
    el('subform').innerHTML = `<label class="f">What's a first step you could do in 2 minutes? Starting earns the full XP.</label>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="avStep" placeholder="Open the email and read the first line"><button class="btn gold small" data-act="avoidGo" data-id="${d.id}">Set</button></div>
      <div class="small muted" style="margin-top:6px">Avoiding something makes it feel bigger. A tiny start shrinks it back.</div>`;
    setTimeout(() => el('avStep') && el('avStep').focus(), 0);
  },
  avoidGo: d => {
    const g = findGate(d.id), t = val('avStep'); if (!t) return sys('Type a tiny first step. Smaller than feels useful is right.');
    saveGateFields(g); g.avoid = true; g.floors = [{ t, done: '' }, { t: 'The rest of it, whenever you are ready', done: '' }]; g.floorIdx = 0; g.touched = today();
    save(); closeSheet(); render(); sys('Gate shrunk to one step. Just start.');
  },
  avoidStale: d => { tab = 'gates'; render(); sheetGate(d.id); ACT.avoidOpen(d); },
  mkRaid: d => { const g = findGate(d.id); saveGateFields(g); makeRaid(g, false); save(); render(); sheetGate(g.id); sys('Raid registered. Break-even and an owner come before announcing.'); },
  waitOpen: d => {
    el('subform').innerHTML = `<label class="f">Check back on</label><div class="row" style="flex-wrap:nowrap"><input type="date" id="wdate" value="${addDays(today(), 3)}"><button class="btn small" data-act="waitGo" data-id="${d.id}">Set</button></div>`;
  },
  waitGo: d => { const g = findGate(d.id); saveGateFields(g); g.state = 'waiting'; g.checkBack = val('wdate') || addDays(today(), 3); save(); closeSheet(); render(); sys('Waiting. It will come back on ' + nice(g.checkBack) + '.'); },
  handOpen: d => {
    el('subform').innerHTML = `<label class="f">Who is taking it?</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="hname" placeholder="A teammate"><button class="btn small" data-act="handGo" data-id="${d.id}">Command</button></div>`;
  },
  handGo: d => { const g = findGate(d.id); const n = val('hname'); if (!n) return; saveGateFields(g); g.owner = n; g.touched = today(); save(); closeSheet(); render(); ripple(); setTimeout(() => sys('Command issued. This gate has a new hunter.', 'gold'), 450); },
  shrink: d => { const g = findGate(d.id); const order = ['E', 'D', 'C', 'B']; const i = order.indexOf(g.size); if (i > 0) g.size = order[i - 1]; g.touched = today(); save(); render(); sheetGate(g.id); sys('Shrunk to size ' + g.size + '. The minimum version counts.'); },
  seal: d => { const g = findGate(d.id); g.state = 'sealed'; save(); closeSheet(); render(); sys('Gate sealed. It will not call you.'); },
  unseal: d => { const g = findGate(d.id); g.state = 'open'; g.touched = today(); save(); closeSheet(); render(); },
  drop: d => { st.gates = st.gates.filter(g => g.id !== d.id); save(); closeSheet(); render(); sys('Gate dropped.'); },
  swapYes: d => { const g = findGate(d.id); g.state = 'waiting'; g.checkBack = addDays(weekKey(today()), 7); save(); render(); sys('Moved to next week.'); },
  mirOpen: () => { mirageOpenNow = true; tab = 'gates'; render(); },
  mirGate: d => { const m = st.mirages.find(x => x.id === d.id); m.status = 'gate'; st.flags.mirageWindow = true; newGate({ title: m.text }); save(); render(); sys('It had a next step after all. Gate registered.'); },
  mirLet: d => {
    const m = st.mirages.find(x => x.id === d.id); const row = el('mir-' + d.id); if (row) row.classList.add('fade');
    setTimeout(() => { m.status = 'letgo'; st.flags.mirageWindow = true; award(5); checkTitles(); save(); render(); }, 850);
    sys('The Mist clears. This was never a monster.');
  },
  mirTherapy: d => { const m = st.mirages.find(x => x.id === d.id); m.status = 'therapy'; st.flags.mirageWindow = true; save(); render(); sys('Set aside for a trusted healer.'); },
  mirBack: d => { const m = st.mirages.find(x => x.id === d.id); m.returns++; save(); render(); },
  mirDone: d => { const m = st.mirages.find(x => x.id === d.id); m.status = 'talked'; save(); render(); },
  weekType: d => { const w = st.weeks[d.k] || (st.weeks[d.k] = { type: 'normal', adjust: 0, rituals: {}, holds: {}, reviewed: false, over: false }); w.type = d.v; save(); render(); },
  fatigueYes: d => { const w = st.weeks[d.k] || (st.weeks[d.k] = { type: 'normal', adjust: 0, rituals: {}, holds: {}, reviewed: false, over: false }); w.adjust = -3; save(); render(); sys('Next week is set 3 lower.'); },
  holdAns: d => { const w = wk(); w.holdAns = w.holdAns || {}; w.holdAns[d.key] = d.v; save(); render(); },
  finishReview: () => {
    const w = wk(), a = w.holdAns || {};
    const ok = k => a[k] === 'yes' || a[k] === 'n/a';
    w.holds.work = !paths().includes('work') || (ok('w1') && ok('w2') && ok('w3'));
    w.holds.life = ok('l1');
    w.over = manaInfo().over;
    ['work', 'life'].forEach(p => { if (w.holds[p]) award(10); });
    if (!w.reviewed) { w.reviewed = true; w.rituals.review = true; award(SIZE_XP.D); }
    save(); render();
    const missing = ['work', 'life'].filter(p => !w.holds[p]);
    if (missing.length) {
      openSheet(`<h3>What's the one thing?</h3><div class="small muted">${missing.map(p => esc(pathName(p))).join(' and ')} didn't quite hold this week. That's fine. What's the one thing that would help next week?</div>
        <input type="text" id="oneThing" style="margin-top:10px" placeholder="One thing"><div class="row" style="margin-top:12px">
        <button class="btn gold" data-act="oneThingGo" data-p="${missing[0]}">Make it a Gate</button><button class="btn ghost" data-act="closeSheet">Skip</button></div>`);
    } else sys('Review done. Every Path held the line.', 'gold');
  },
  oneThingGo: d => { const t = val('oneThing'); if (t) { newGate({ title: t, path: d.p }); st.flags.oneThing = t; } closeSheet(); save(); render(); },
  wbToggle: () => { st.flags.wbActive = !st.flags.wbActive; save(); render(); },
  staleReal: d => { findGate(d.id).touched = today(); save(); render(); },
  staleSeal: d => { findGate(d.id).state = 'sealed'; save(); render(); },
  staleDrop: d => { st.gates = st.gates.filter(g => g.id !== d.id); save(); render(); },
  tick: d => { const k = d.p + st.ranks[d.p] + d.i; st.ticks[k] = !st.ticks[k]; save(); render(); },
  clearTrial: d => { clearTrial(d.p); save(); render(); },
  arise: d => {
    ripple(); sound('ring');
    const name = SHADOW_NAMES[d.id] || 'Shadow';
    st.shadows[d.id] = { name, date: today() }; save();
    setTimeout(() => { sys('ARISE.', 'gold'); }, 300);
    setTimeout(() => { sys(name + ' now carries ' + DAILY.find(q => q.id === d.id).t.toLowerCase() + '.', 'gold'); render(); }, 1400);
  },
  equip: d => { st.equipped = st.equipped === d.t ? null : d.t; save(); render(); },
  settingsRead: () => {
    readSetup();
    ['night', 'move', 'fuel'].forEach(id => {
      const q = DAILY.find(x => x.id === id), base = { full: q.full, min: q.min };
      if (id === 'move') { const L = LEVELS[st.level] || LEVELS.zero; base.full = L.move[0]; base.min = L.move[1]; }
      const f = val('dqf_' + id), m = val('dqm_' + id), o = {};
      if (f && f !== base.full) o.full = f; if (m && m !== base.min) o.min = m;
      if (o.full || o.min) st.dq[id] = o; else delete st.dq[id];
    });
    st.rewards = val('sRewards').split('\n').map(x => x.trim()).filter(Boolean);
    const good = val('sGood').split('\n').map(x => x.trim()).filter(Boolean); if (good.length) st.goodList = good;
    priv.sound = el('sSound').checked; priv.preview = el('sPreview').checked; priv.dateOverride = val('sDate');
  },
  settingsSave: () => { ACT.settingsRead(); save(); closeSheet(); boot(); sys('Settings saved.'); },
  export: () => {
    const blob = new Blob([JSON.stringify(st, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'arise-backup-' + today() + '.json'; a.click();
    st.lastBackup = today(); save(); render();
  },
  wipe: () => { if (!confirm('Delete everything in this browser and start over?')) return; localStorage.removeItem(KEY); localStorage.removeItem(PKEY); st = freshState(); priv = freshPriv(); closeSheet(); boot(); },
};
function saveGateFields(g) {
  if (!g) return;
  if (el('gtitle')) g.title = val('gtitle') || g.title;
  if (el('gdate')) g.date = val('gdate');
  if (el('gowner')) { const o = val('gowner'); g.owner = o ? o : 'me'; }
  if (g.raid) {
    if (el('rcost')) g.raid.costs = val('rcost');
    if (el('rprice')) g.raid.price = val('rprice');
    if (el('rowner')) g.raid.owner = val('rowner');
    if (el('rsold')) g.raid.sold = val('rsold');
    if (el('rspent')) g.raid.spent = val('rspent');
    if (el('rad')) g.raid.ad = val('rad');
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) { if (e.target === el('sheet')) closeSheet(); return; }
  const f = ACT[b.dataset.act]; if (f) { e.preventDefault(); f(b.dataset, b); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); ACT[e.target.dataset.enter](e.target.dataset); }
});
document.addEventListener('input', e => {
  if ((e.target.id === 'rcost' || e.target.id === 'rprice') && el('rbe')) {
    const be = breakEven({ costs: val('rcost'), price: val('rprice') });
    el('rbe').textContent = be ? 'Break-even: ' + be + ' tickets' : '';
  }
});

/* ---------------- Render root ---------------- */
function render() {
  el('previewChip').hidden = !priv.preview;
  el('dateLabel').textContent = nice(today());
  const safe = st.onboarded && safeNow();
  document.body.classList.toggle('safe', safe);
  el('camp').hidden = !safe;
  const bday = isBirthday(today());
  el('motes').hidden = !bday;
  if (bday && !el('motes').children.length) el('motes').innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-duration:${14 + (i % 7) * 3}s;animation-delay:-${i * 2}s"></i>`).join('');
  if (!st.onboarded) { document.querySelector('nav.tabs').hidden = true; return onboarding(); }
  document.querySelector('nav.tabs').hidden = false;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  el('view').innerHTML = tab === 'today' ? renderToday() : tab === 'gates' ? renderGates() : tab === 'week' ? renderWeek() : renderStatus();
}
function kindWindow() {
  const w = weekKey(today()); if (st.kindWeek === w || safeNow() || !st.created) return;
  const y = priv.mind[addDays(today(), -1)];
  let line = null;
  if (y && y.s <= 2) line = 'Hidden achievement: you opened the System on a hard day.';
  else if (st.flags.rested && Math.random() < .3) line = 'The System noticed you rested. It approves.';
  if (line) { st.kindWeek = w; save(); setTimeout(() => sys(line, 'gold'), 900); }
}
function boot() {
  if (st.onboarded) {
    if (st.safe.active && !st.safe.days.includes(today())) st.safe.days.push(today());
    pruneMind(); wakeWaiting(); save();
  }
  render();
  if (st.onboarded) kindWindow();
}
// Ask the phone to keep this app's data even when storage runs low.
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// Home-screen shortcut "Add a gate" opens straight into the capture box.
if (/[?&]add=1/.test(location.search)) { tab = 'gates'; showLate = true; setTimeout(() => { const c = el('cap'); if (c) c.focus(); }, 50); }
boot();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
