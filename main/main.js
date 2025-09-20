
const { app, BrowserWindow, screen, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const groq = require('groq-sdk');
const openai = require('openai');

require('dotenv').config();

// const aiClient = new openai.OpenAI({
//   apiKey: process.env.LLM_API_KEY,
//   baseURL: process.env.LLM_API_BASE_URL
// });

// const aiClient = new openai.OpenAI();

if (!process.env.GROQ_API_KEY) {
  console.error('GROQ_API_KEY is not set in environment variables.');
}

const aiClient = new groq.Groq({
  apiKey: process.env.GROQ_API_KEY,
});

let petWindow, chatWindow, instachatWindow;

function createPetWindow() {
  petWindow = new BrowserWindow({
    width: 128,
    height: 128,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false, 
    hasShadow: false,
    skipTaskbar: true,
    focusable: true,
    acceptFirstMouse: true, // macOS: 允許第一次點擊就啟動
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  petWindow.loadFile(path.join(__dirname, '../renderer/pet/index.html'));
  
  // 啟動時強制獲得焦點
  petWindow.once('ready-to-show', () => {
    petWindow.show();
    petWindow.focus();
  });
  
  // 移除自動重新獲得焦點的邏輯，改為提供手動方式
}

function createChatWindow() {
  chatWindow = new BrowserWindow({
    width: 650,
    height: 700,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  chatWindow.loadFile(path.join(__dirname, '../renderer/chat/index.html'));

  chatWindow.on('show', () => {
    instachatWindow.hide();
  });
  chatWindow.on('focus', () => {
    instachatWindow.hide();
  });

  chatWindow.on('close', (event) => {
    event.preventDefault();
    chatWindow.hide();
  });
}

function createInstachatWindow() {
  instachatWindow = new BrowserWindow({
    width: 300,
    height: 200,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true
    }
  });
  instachatWindow.loadFile(path.join(__dirname, '../renderer/instachat/index.html'));
  instachatWindow.hide();
}

function toggleInstachatWindow() {
  if (instachatWindow.isVisible()) {
    if (instachatWindow.isFocused()) {
      instachatWindow.hide();
    }
    else {
      instachatWindow.focus();
    }
  }
  else {
    instachatWindow.show();
  }
}

function toggleChatWindow() {
  if (chatWindow.isVisible()) {
    if (chatWindow.isFocused()) {
      chatWindow.hide();
    }
    else {
      chatWindow.focus();
    }
  }
  else {
    chatWindow.show();
  }
}

async function messageToAi(message) {
  console.log('Sending message to AI:', message);

  // Groq SDK example
  return await aiClient.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    temperature: 1,
    max_completion_tokens: 8192,
    messages: [{
      role: 'user',
      content: message
    }],
  })
  .catch(async (err) => {
    if (err instanceof groq.GroqError) {
      console.error(err.status + ' ' + err.name + ': ' + err.message);
    }
    else {
      throw err;
    }
  })
  .then((res) => {
    console.log(res.choices);
    if (res && res.choices && res.choices.length > 0) {
      return res.choices[0].message.content;
    }
  });

  // OpenAI SDK example
  // await aiClient.chat.completions.create({
  //     model: 'gpt-4o',
  //     input: message
  //   })
  //   .then((response) => {
  //     console.log('OpenAI response:', response);
  //     if (response && response.choices && response.choices.length > 0) {
  //       return response.choices[0].message.content;
  //     }
  //   })
  //   .catch((error) => {
  //     console.error('Error from OpenAI:', error);
  //   });

  // Direct fetch example (if needed)
  // return await fetch('https://nrmfcuv5mcnizdjv.ai-plugin.io/chat/completions', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${process.env.LLM_API_KEY}`
  //   }
  // })
  // .catch((error) => {
  //   console.error('Error during fetch:', error);
  // }) 
  // .then(response => response.json())
  // .then(data => {
  //   console.log('response data:', data);
  // });
}

app.whenReady().then(async () => {
  createPetWindow();
  createChatWindow();
  createInstachatWindow();

  // 註冊全域快捷鍵：Esc 來重新啟動桌寵焦點
  globalShortcut.register('Escape', () => {
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.show();
      petWindow.focus();
      petWindow.setIgnoreMouseEvents(false); // 暫時禁用滑鼠穿透
      
      // 發送訊息給前端重置拖拽狀態
      petWindow.webContents.send('reset-drag-state');
      
      setTimeout(() => {
        petWindow.setIgnoreMouseEvents(true, { forward: true });
      }, 1000);
    }
  });

  globalShortcut.register('Alt+P', () => {
    toggleChatWindow();
    // toggleInstachatWindow();
  });
});

// IPC handlers
ipcMain.handle('get-displays', () => {
  const displays = screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    workArea: d.workArea
  }));
  return { primary: screen.getPrimaryDisplay().id, displays };
});

ipcMain.handle('move-window', (_e, { x, y }) => {
  if (petWindow) petWindow.setPosition(Math.round(x), Math.round(y), false);
});

ipcMain.handle('get-current-position', () => {
  if (petWindow) {
    const [x, y] = petWindow.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});

ipcMain.handle('toggle-mouse-through', (_e, ignore) => {
  if (petWindow) {
    if (ignore) {
      // 啟用滑鼠穿透 - 立即設置，不等待
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      // 禁用滑鼠穿透 - 立即設置
      petWindow.setIgnoreMouseEvents(false);
      petWindow.focus(); // 確保視窗獲得焦點
    }
  }
});

// 新增：手動重新獲得焦點的方法
ipcMain.handle('refocus-window', () => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus();
    petWindow.show(); // 確保視窗可見
    return true;
  }
  return false;
});

// 新增：重置視窗狀態的 IPC handler
ipcMain.handle('reset-window-state', () => {
  if (petWindow && process.platform === 'darwin') {
    // 強制重新建立視窗的滑鼠事件狀態
    petWindow.setAlwaysOnTop(false);
    petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
    
    setTimeout(() => {
      petWindow.setIgnoreMouseEvents(true, { forward: true });
    }, 100);
  }
});

ipcMain.handle('toggle-chat', () => toggleChatWindow());

ipcMain.handle('show-instachat-at-pet', () => {
  if (petWindow && instachatWindow) {
    const [petX, petY] = petWindow.getPosition();
    instachatWindow.setPosition(petX + 130, petY, false);
    toggleInstachatWindow();
  }
});

ipcMain.handle('message-to-ai', async (_e, message) => {
  return await messageToAi(message);
});

// Keep app alive even if windows are hidden (typical for tray apps)
// Do not quit on macOS when all windows closed
app.on('window-all-closed', () => {
  // no-op to keep the pet running
});

app.on('activate', () => {
  if (!petWindow) createPetWindow();
});

app.on('will-quit', () => {
  // 清理全域快捷鍵
  globalShortcut.unregisterAll();
});

// Helpful: log any unhandled rejections so the app doesn't crash silently
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});
