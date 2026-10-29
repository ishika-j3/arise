# ARISE

A life operating system built like Solo Leveling: a small Daily Quest, Gates for tasks, a weekly review, and Paths that rank up through real-world trials. It is set up by each player on the first screen, so it works from "starting from zero" to "already active".

## Use it on a phone

Open the site in Chrome on Android, then tap the menu and choose **Install app** (or **Add to Home screen**). Use only the installed app from then on. On iPhone, use Safari, Share, **Add to Home Screen**.

## Where data lives

Without an account, everything stays on the device and nothing is sent anywhere.

| Store | What | In the backup file? | In the account copy? |
|---|---|---|---|
| `arise-state-v1` | Gates, quests, XP, trials, your setup | Yes | Yes, encrypted |
| `arise-private-v1` | Mind check lines and low-energy reasons (kept 14 days), the 1 to 5 mood number (kept 90 days, for patterns), cycle dates, birthday | Never | Yes, encrypted |

The app asks the phone to keep its storage, and reminds you weekly to save a backup (Settings, Download backup).

## Optional account (free)

Settings, Account: **Create account** with an email and password, then **Log in** on any other phone to get everything back.

- The password never leaves the phone as-is. Two keys are made from it on the phone: one to log in, one to encrypt the save (AES-GCM, 256-bit). The database (Supabase, free plan) stores only the encrypted blob, one row per player under row-level security, so nobody with database access can read it. See `supabase-setup.sql` and `account.js`.
- No emails are sent, so there is nothing to rate-limit or pay for.
- A forgotten password means the account copy can't be unlocked. Keep the backup file too.
- Logging out clears the phone; everything stays in the account for next time.
- The free Supabase project pauses after 7 days with no use by anyone. The app keeps working on the phone while paused, and syncs again once the project is resumed.

## Paste a list

Gates tab, **Paste a list**. One item per line:

```
Title | Path | Size | Date | Owner | Type
```

Paths: body, mind, work, guild, life (or the names you gave them). Types: gate, daily, weekly, mirage, raid, raid grandfathered, dungeon, waiting, sealed. Only the title is needed. Items already in your gates are left out.

## Cycle guidance: what it is based on

The cycle feature is optional and off by default. It shows the phase and adjusts the plan; it does not prescribe phase-based training, because the evidence for that is weak. How you feel on the day comes first.

- Performance changes across the cycle are trivial on average, slightly lower in the early follicular phase, evidence quality low; the authors recommend a personal approach. McNulty et al. 2020, Sports Medicine 50:1813 to 1827.
- No clear effect of cycle phase on strength or on gains from resistance training. Colenso-Semple et al. 2023, Frontiers in Sports and Active Living 5:1054542.
- Regular exercise (yoga to aerobics, usually about 3 times a week) is linked to a large drop in period pain, low-quality evidence. Armour et al. 2019, Cochrane Review CD004142.
- Average cycle 29.3 days, average luteal phase 12.4 days, so ovulation is estimated as cycle length minus 12.4. Bull et al. 2019, npj Digital Medicine 2:83.
- Luteal phase body temperature and resting heart rate rise slightly, and sleep can be lighter before a period: general physiology (for example Baker and Lee 2018, Sleep Medicine Clinics).

- Premenstrual worsening of existing anxiety or depression is common, and PMDD (a severe form) affects about 3 to 8% of people who menstruate (ACOG). So the app checks whether your own low days cluster before your period, after 2 cycles of data.
- On hormonal contraception, natural hormone swings are mostly suppressed, so phase tips switch off.

Estimates only. Not for contraception and not medical advice.

## Quest level-ups: how goals grow, and where they stop

Move, Night and Fuel each climb a ladder. Steps are offered, never forced, and time stops rising at a cap.

- Move: 10 → 15 → 20 → 30 minutes, then two strength days, then one harder 20 to 30 minute session a week. 30 minutes on 5 days is about 150 minutes a week, the low end of the WHO 2020 guideline (150 to 300 minutes of moderate activity, plus strength on 2 or more days). After that, only quality and variety change.
- Night follows sleep-therapy (CBT-I) practice rather than ever-earlier bedtimes: wind-down, then a fixed wake time (sleep regularity matters for health beyond duration), then the phone out of reach, then "get up if not asleep after about 20 minutes".
- Fuel only adds: protein, then fruit and vegetables, building towards five portions a day (WHO: at least 400 g). There is no calorie or weight language.
- The minimum version never rises, so a bad day always has something that counts.
- A step up needs the full version on 10 of the last 14 counted days and 21 days on the current step. Only one quest changes per 21 days, because habits take about 66 days to settle (Lally et al. 2010).
- There are no offers on hard stretches: Safe Zone, a low-energy reason, mood averaging 2 or less over a week, or the premenstrual window. Low-energy days count as neutral.
- "Not yet" waits 14 days; after two, the System stops asking (Settings can turn it back on). A lighter step is offered, with no penalty, when a quest goes quiet.
- Before harder sessions the app adds a safety line: chest pain, feeling faint or a heart condition means check with a doctor first.

## Mind mechanics: what they are based on

ARISE doesn't diagnose or treat anything. Its mechanics borrow from well-tested ideas:

- Behavioural activation: small planned activities, then noticing the effect on mood (Ekers et al. 2014, PLoS ONE). This is the "one small good thing" slot and the mood and activity link in the Sunday review.
- Exercise helps depression, including walking, yoga and strength training (Noetel et al. 2024, BMJ).
- Avoidance keeps anxiety going; a tiny first step makes the task smaller. "I've been avoiding this" gates pay the full XP for starting.
- Worry postponement: set worries aside for a fixed window. These are Mirages, reviewed twice a week.
- Writing a to-do list before bed helped people fall asleep faster (Scullin et al. 2018, Journal of Experimental Psychology: General). This is "Close the gates".
- No streaks to lose, minimum versions that count in full and a Return Quest instead of penalties, because shame after a missed day drives quitting.

## Run it locally

```
node serve.js
```

Then open http://localhost:4500.
