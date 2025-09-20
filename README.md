# Desktop Pet MVP (Electron + Three.js)

A tiny MVP that shows a transparent desktop pet window (always-on-top) rendered with three.js
that bounces around your screen. Double-click the pet to toggle a minimal chat window.

## Run

```sh
npm install
npm start   # Run normally
npm run dev # Run with nodemon, that will restart the app automatically after editing
```

## Features

- Transparent 128×128 pet window (sits behind normal apps, not always-on-top)
- Auto-walk with simple bounce on screen bounds
- Hover to interact; drag to move; mouse leaves to restore click-through
- Double-click to toggle chat window
- ESC to quickly refocus/reset pet window
- PNG sprites preferred (fallback to SVG, then to a built-in default)

## Interactions & Shortcuts

- Hover: pet becomes interactable (disables click-through)
- Drag: click and move to reposition
- Mouse up: restores state based on cursor position
- Double-click: toggle chat window
- Right-click: manual refocus
- ESC: refocus and reset drag state (global shortcut)
