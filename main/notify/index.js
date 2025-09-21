const { app, Notification, ipcMain, nativeImage } = require('electron');
const path = require('path');

/* 解析圖示（Win/Linux 用），macOS 會忽略每則 icon */
function resolveIcon(icon) {
  if (!icon) return undefined;
  const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '../..'); // 專案根
  const p = path.isAbsolute(icon) ? icon : path.join(base, icon);
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? undefined : img;
}

/* 發送通知（Renderer 也可透過 IPC 呼叫） */
function sendNotification({ title, body, silent, icon } = {}) {
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: title || app.getName() || 'Flabba',
    body: body || '',
    silent: !!silent,
    icon: process.platform === 'darwin' ? undefined : resolveIcon(icon)
  });
  n.show();
  return true;
}

/* 天氣文字 */
function weatherCodeToText(code) {
  if (code === 0) return '晴朗';
  if ([1,2,3].includes(code)) return '多雲';
  if ([45,48].includes(code)) return '霧';
  if ([51,53,55].includes(code)) return '毛毛雨';
  if ([61,63,65].includes(code)) return '雨';
  if ([66,67].includes(code)) return '凍雨';
  if ([71,73,75,77].includes(code)) return '雪';
  if ([80,81,82].includes(code)) return '陣雨';
  if (code === 95) return '雷雨';
  if ([96,99].includes(code)) return '雷雨冰雹';
  return '天氣';
}

/* 抓新竹天氣文字 */
async function fetchHsinchuWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=24.8138&longitude=120.9675'
      + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code'
      + '&timezone=Asia%2FTaipei';
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const cur = data.current;
    return `新竹 ${Math.round(cur.temperature_2m)}°C ${weatherCodeToText(cur.weather_code)} 濕度${cur.relative_humidity_2m}% 風${cur.wind_speed_10m}m/s`;
  } catch (e) {
    console.warn('weather error', e);
    return null;
  }
}

/* 每日 12:00 提醒 */
function scheduleDailyNoonNotification() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(12, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;

  setTimeout(() => {
    sendNotification({ title: '午間提醒', body: '現在是中午 12:00，記得用餐或休息。' });
    setInterval(() => {
      sendNotification({ title: '午間提醒', body: '現在是中午 12:00，記得用餐或休息。' });
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

/* 每日 18:00 提醒（附天氣） */
function scheduleDailyCheckoutNotification() {
  const now = new Date();
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;

  // 可背景定期預抓天氣（非必須）
  fetchHsinchuWeather();
  setInterval(fetchHsinchuWeather, 30 * 60 * 1000);

  setTimeout(() => {
    (async () => {
      const w = await fetchHsinchuWeather();
      const body = w ? `現在是晚上 18:00，該準備下班了！\n${w}` : '現在是晚上 18:00，該準備下班了！';
      sendNotification({ title: '該下班囉～', body });
    })();
    setInterval(() => {
      (async () => {
        const w = await fetchHsinchuWeather();
        const body = w ? `現在是晚上 18:00，該準備下班了！\n${w}` : '現在是晚上 18:00，該準備下班了！';
        sendNotification({ title: '該下班囉～', body });
      })();
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

/* 註冊 IPC：renderer 端呼叫 window.electronAPI.notify(...) */
function initNotify() {
  // 先移除已存在的 handler，避免 "second handler" 錯誤
  ipcMain.removeHandler('notify');
  ipcMain.handle('notify', (_event, payload) => {
    try { return sendNotification(payload || {}); }
    catch (err) { console.error('notify failed:', err); return false; }
  });
}

module.exports = {
  initNotify,
  sendNotification,
  fetchHsinchuWeather,
  scheduleDailyNoonNotification,
  scheduleDailyCheckoutNotification
};