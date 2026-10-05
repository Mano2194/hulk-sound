# HULK SOUND™

English text to speech in the browser. Free, no signup, no server, no cost.

Type text, press **Play**, and it reads it aloud using the voices already on your
machine.

## Use it

Open `index.html` in any modern browser — Chrome, Edge, Safari or Firefox.

Everything sits in one row under the text box:

```
[ ▶ Play ]  [ − ————●———— +  1.00× ]  [ voice menu ▾ ]
```

- **Play** reads the text. While it reads, the same button becomes **Stop**;
  press it again (or hit **Space**) to cut off.
- **− / +** change the speed by 0.10, or drag the slider for anything between
  0.50× and 2.00×. Changing the speed mid-sentence restarts from the top with the
  new speed, so you hear the difference right away.
- The **voice menu** lists every English voice your browser exposes. Picking one
  plays a short sample so you hear what you chose. Your choice is remembered
  next time.

## Notes

- Speech comes from the browser's own engine (the Web Speech API), so it runs
  offline and nothing is uploaded.
- Voices come from your operating system, so the list depends on the machine.
  On Windows you can add more under
  *Settings → Time & Language → Language → Add voice*.
- Text is split into sentences with a short pause between them, which reads far
  more naturally than one long utterance.

## Files
- `index.html` — page structure
- `styles.css` — styling, dark/light
- `app.js` — voice menu, speech, play/stop
- `.nojekyll` — keeps GitHub Pages from running Jekyll on these files

designed by OSMAN™