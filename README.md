# ARISE

A life operating system built like Solo Leveling: a small Daily Quest, Gates for tasks, a weekly review, and Paths that rank up through real-world trials. It is set up by each player on the first screen, so it works from "starting from zero" to "already active".

## Use it on a phone

Open the site in Chrome on Android, then tap the menu and choose **Install app** (or **Add to Home screen**). Use only the installed app from then on. On iPhone, use Safari, Share, **Add to Home Screen**.

## Where data lives

Everything stays on the device. Nothing is sent anywhere.

| Store | What | In the backup file? |
|---|---|---|
| `arise-state-v1` | Gates, quests, XP, trials, your setup | Yes |
| `arise-private-v1` | Mind check lines and low-energy reasons (kept 14 days), the 1 to 5 mood number (kept 90 days, for patterns), cycle dates, birthday | Never |

The app asks the phone to keep its storage, and reminds you weekly to save a backup (Settings, Download backup).

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
