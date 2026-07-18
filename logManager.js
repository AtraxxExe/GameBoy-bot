const fs = require('node:fs');
const path = require('node:path');

const LOG_FILE = path.join(__dirname, 'logs.json');

if (!fs.existsSync(LOG_FILE)) {
  fs.writeFileSync(LOG_FILE, JSON.stringify({}), 'utf-8');
}

function getLogs() {
  try {
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
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    timestamp: Math.floor(Date.now() / 1000),
    ...logData
  };

  allLogs[category].unshift(logEntry);
  
  if (allLogs[category].length > 200) {
    allLogs[category] = allLogs[category].slice(0, 200);
  }

  fs.writeFileSync(LOG_FILE, JSON.stringify(allLogs, null, 2), 'utf-8');
}

module.exports = { getLogs, saveLog };