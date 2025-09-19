// macFrontmost.js - macOS frontmost app watcher using AppleScript
// Shows how to query the frontmost application name periodically.

const { exec } = require('child_process');

function getFrontmostAppName() {
  return new Promise((resolve) => {
    const script = 'tell application "System Events" to get name of first application process whose frontmost is true';
    exec(`osascript -e '${script}'`, (err, stdout) => {
      if (err) return resolve(null);
      resolve(String(stdout || '').trim());
    });
  });
}

// Watch frontmost app and invoke callback(name) on changes.
function watchFrontmostApp(onChange, intervalMs = 500) {
  let last = null;
  const timer = setInterval(async () => {
    const name = await getFrontmostAppName();
    if (name && name !== last) {
      last = name;
      onChange(name);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

function isDesktopProcess(name) {
  // 視為「桌面」的前景程序
  return ['Finder', 'Dock', 'SystemUIServer', 'loginwindow'].includes(name);
}

module.exports = { getFrontmostAppName, watchFrontmostApp, isDesktopProcess };
