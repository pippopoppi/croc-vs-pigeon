# 🐊 Coccodrillo vs Piccione 🐦

**ONE CROCODILE. INFINITE PIGEONS. ZERO DIGNITY.**

A one-button survival arcade game by Pippo Poppi Games. A giant crocodile in the middle of Rome versus an army of arrogant Roman pigeons bombing it from above.

**Play it:** https://pippopoppi.github.io/croc-vs-pigeon/

No install, no menus, no login, no tutorial. One HTML page plus one JavaScript file on an HTML5 canvas, with all the art drawn in code as vector shapes at full device resolution.

## How to play

- **Hold** to charge the jump, **release** to leap with open jaws and bite. Mouse, spacebar, or a finger on the phone.
- **Tap again in mid-air** to snap the jaws open for another bite, as many times as you like. Keep the finger down and the next charge starts the moment you land.
- **Slide** the same finger left or right to move the crocodile, on the ground or in the air, to get under a pigeon or out from under a dropping. Arrow keys or A/D on desktop.
- The longer you charge, the higher you jump. Time it to intercept pigeons while dodging what they drop.
- Every pigeon is 100 points. Consecutive catches raise the combo multiplier (up to ×5). A jump with no catch, or a hit, resets it.
- Each poop takes one heart. You start with three, and every boss you eat adds one with no limit, so stacking lives is how you push a record. When the hearts are gone, the game ends. There is no clock: survive as long as you can.
- Speed ramps up all the time. After 45 seconds the INFERNO starts and never stops.

## The brainrot

- **Piccione maranza**: sunglasses, gold chain, unpredictable flight, and it dodges when you jump at it.
- **Piccione d'oro**: rare, very fast, 1,000 points.
- **Italian combo**: five catches in a row and a distorted tarantella plays.
- **Final boss**: a giant pigeon shows up as a special event, needs three bites, drops a storm of poop, and gives an extra heart when eaten, beyond the starting three.

At the end you get the **FINAL RESULT** screen: YOU GOT PIGEONED, time survived, score, pigeons eaten, and a **Copy X challenge** button that puts a ready-made challenge in your clipboard, plus a direct post-to-X button.

## Ranking

Before playing you type a nickname. Every finished game goes into the ranking under that name, and a new score only replaces your row when it is better, so you can reuse the same name forever and keep your record. The ranking screen (also reachable from the result screen with "Classifica / cambia nome") shows the top 10 with score and time survived.

Out of the box the ranking is per device, stored in the browser. To make it a world ranking shared by everyone, deploy the tiny server in `server/` (a Cloudflare Worker with one KV key, free tier is plenty) and point the game at it:

```
cd server
npx wrangler login                       # opens the browser once
npx wrangler kv namespace create BOARD   # paste the printed id into wrangler.toml
npx wrangler deploy                      # prints the Worker URL
```

then set `LEADERBOARD_URL` at the top of `game.js` to that URL (with a trailing slash) and push. The server keeps one row per nickname, rejects impossible scores, stores the top 500 and answers `GET ?top=10`, `GET ?name=X` and `POST {name, score, time, eaten}`. If the server cannot be reached, the game quietly falls back to the device ranking.

## Running locally

```
python3 -m http.server 8000
```

then open http://localhost:8000/.

## Regenerating the share image

```
python3 tools/make_og.py
```

needs Pillow and writes `og.png` and `icon-180.png`.

## Licence

MIT
