# Cascade

Cascade is a browser-only Draw Three Klondike solitaire. Build each of the four foundations from Ace to King. Once the last card comes home, the foundations launch into a bouncing cascade across the felt.

## Run

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a static production site, run `npm run build` and serve the `dist/` directory. The site also works from a subpath.

## Controls

Click or tap the stock to turn three cards. Once it is empty, click it again to recycle the waste. Drag a face-up card or a descending, alternating-color run onto a legal column or foundation. Only Kings can fill empty columns. Double-click a playable waste or tableau card to send it to a foundation. The bottom strip starts a new game, returns to the title, or toggles sound. Menus also work with arrow keys or W/S, Enter or Space to select, and Escape to leave the how-to screen. Press backtick to show the debug overlay.

## Checks

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` run the repository checks.
