
# Desktop Pet MVP (Electron + Three.js)

A tiny MVP that shows a transparent desktop pet window (always-on-top) rendered with three.js
that bounces around your screen. Double-click the pet to toggle a minimal chat window.

## Run

```bash
cd desktop-pet-mvp
npm install
npm start
```

> If `npm start` doesn't launch, ensure you have Node.js installed and that `electron` finished installing.

## Files

- `main/main.js` — Electron main process (creates windows, IPC handlers)
- `preload/preload.js` — Safe bridge exposing a few APIs to renderer
- `renderer/pet/index.html` — Three.js transparent scene + window move/drag/dblclick
- `renderer/chat/index.html` — Minimal chat popup (stubbed replies)

## Tips

- The pet window ignores mouse events by default so it doesn't block clicks. When you move your mouse over it, it becomes interactable for drag/dblclick; when the mouse leaves, it goes back to click-through.
- To swap the 3D sphere for your own GLB model, see the commented GLTFLoader code in `renderer/pet/index.html` and put your model under `assets/pet/model.glb`.
- If you use multi-monitor, the MVP uses the primary display's work area to compute bounds.
