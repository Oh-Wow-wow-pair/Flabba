# Flabba Desktop Pet

A transparent, draggable desktop pet with hand-drawn (handwriting picture) PNG animations, a minimal chat/insta-chat UI, daily notifications, and an optional backend database that can fetch user data. The AI assistant is grounded by a small RAG corpus to limit domain-specific information.
[Deep Wiki](https://deepwiki.com/Oh-Wow-wow-pair/Flabba)

## Quick Start

- Requirements: Node.js 18+ (Python 3.10+ only if running the optional backend)
- Install & run:
```
npm install
npm start
npm run dev (with nodemon auto-reload)
```
- VS Code: use the “Run Electron app” task in [.vscode/tasks.json](.vscode/tasks.json)
- Optional backend (Flask):
  - cd database && pip install -r requirements.txt
  - python api_server.py (default http://localhost:5001)

## Features

- Desktop pet
  - Transparent 128×128, click-through by default; hover to interact; drag to move; simple bounds-bounce with off-screen safety
  - Native right-click menu: open Chat/Instachat, toggle pause/resume
  - Unified pause state (manual/context-menu/other windows)
  - Performance: animations keep running in background (backgroundThrottling disabled)

- Windows
  - Chat window (centered)
  - Instachat window (docks to pet, follows position)

- Shortcuts & interactions
  - ESC: refocus pet, reset drag state (global shortcut)
  - Alt+P: toggle Chat
  - Cmd/Ctrl+Shift+L: toggle Leave window
  - Robust drag handling and recovery after context-menu closes

- Sprites (hand-drawn “handwriting picture” support)
  - Hand-drawn PNG frames preferred; fallback to normal PNG, then SVG, then a built-in default
  - States: idle_sleeping, awake, walking, grasp, serious

- Notifications
  - Renderer→Main notify IPC
  - Daily schedules: lunch 12:00 and checkout 18:00 with Hsinchu weather

- AI assistant (Dify + RAG)
  - Dify-based chat; Markdown rendered to HTML
  - Staff-aware prompt from local DB
  - RAG corpus included to limit domain-specific information
  - Chat pipeline

- Backend data service
  - Flask API to fetch user data and manage leave flow (LLM callback, leave record, frontend queries)

## Project Structure

- Main process
  - Core and windows: [main/main.js](main/main.js)
  - Notifications: [main/notify/index.js](main/notify/index.js)
  - macOS frontmost (optional): [main/macFrontmost.js](main/macFrontmost.js)
- Preload
  - Bridge and IPC exposure: [preload/preload.js](preload/preload.js)
- Renderers
  - Pet: [renderer/pet/index.html](renderer/pet/index.html)
  - Chat: [renderer/chat/index.html](renderer/chat/index.html), [renderer/chat/index.js](renderer/chat/index.js)
  - Instachat: [renderer/instachat/index.html](renderer/instachat/index.html), [renderer/instachat/index.js](renderer/instachat/index.js)
  - Leave: [renderer/leave/index.html](renderer/leave/index.html)
- Data & RAG
  - Local staff DB for prompts: [db.js](db.js), [company.db](company.db)
  - RAG corpus: [RAG/tsmc_benefits](RAG/tsmc_benefits)
- Backend (optional)
  - Flask API and docs: [database/](database/)

## Backend Database: fetch user data

- Use the frontend endpoints to fetch the latest user data and summary
- Endpoints and examples: [database/README.md](database/README.md)
  - GET /api/frontend/users/{user_id}/data
  - GET /api/frontend/users/{user_id}/summary
  - POST /api/llm/callback (LLM writes back extracted fields)
  - POST /api/leave/record (leave records; deducts annual leave when applicable)
- Server entry: [database/api_server.py](database/api_server.py)
- Data access: [database/data_handler.py](database/data_handler.py)
