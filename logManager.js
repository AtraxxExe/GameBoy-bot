const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, 'logs.json');

function ensureLogFile() {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}

function safeWriteLogFile(data) {
  try {
    ensureLogFile();
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing logs file:", err);
  }
}

function getLogs() {
  try {
    ensureLogFile();
    const data = fs.readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading logs file:", err);
    return {};
  }
}

function saveLog(category, logData) {
  const allLogs = getLogs();
  if (!allLogs[category]) {
    allLogs[category] = [];
  }

  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    timestamp: Math.floor(Date.now() / 1000),
    ...logData
  };

  allLogs[category].unshift(logEntry);

  if (allLogs[category].length > 200) {
    allLogs[category] = allLogs[category].slice(0, 200);
  }

  safeWriteLogFile(allLogs);
}

module.exports = { getLogs, saveLog };