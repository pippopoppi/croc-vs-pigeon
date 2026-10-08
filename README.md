# 🐊 Coccodrillo vs Piccione 🐦

**ONE CROCODILE. INFINITE PIGEONS. ZERO DIGNITY.**

A 30-second, one-button arcade game by Pippo Poppi Games. A giant crocodile in the middle of Rome versus an army of arrogant Roman pigeons bombing it from above.

**Play it:** https://pippopoppi.github.io/croc-vs-pigeon/

No install, no menus, no login, no tutorial. One HTML page plus one JavaScript file on an HTML5 canvas, drawn in code at 200×360 and scaled up for the pixel-art look.

## How to play

- **Hold** to charge the jump, **release** to leap with open jaws and bite. Mouse, spacebar, or a finger on the phone.
- **Slide** the same finger left or right to move the crocodile, on the ground or in the air, to get under a pigeon or out from under a dropping. Arrow keys or A/D on desktop.
- The longer you charge, the higher you jump. Time it to intercept pigeons while dodging what they drop.
- Every pigeon is 100 points. Consecutive catches raise the combo multiplier (up to ×5). A jump with no catch, or a hit, resets it.
- Each poop takes one of your three hearts. After 30 seconds, or when the hearts are gone, the game ends.
- Speed ramps up all the time. The last ten seconds are the INFERNO.

## The brainrot

- **Piccione maranza**: sunglasses, gold chain, unpredictable flight, and it dodges when you jump at it.
- **Piccione d'oro**: rare, very fast, 1,000 points.
- **Italian combo**: five catches in a row and a distorted tarantella plays.
- **Final boss**: a giant pigeon shows up as a special event, needs three bites, drops a storm of poop, and gives a heart back when eaten.

At the end you get the **FINAL RESULT** screen: YOU GOT PIGEONED, score, pigeons eaten, and a **Copy X challenge** button that puts a ready-made challenge in your clipboard, plus a direct post-to-X button.

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
