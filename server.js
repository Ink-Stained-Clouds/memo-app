const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

let store = { tasks: [] };

function safeStore(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) {
    return { tasks: [] };
  }
  return { tasks: data.tasks };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      store = safeStore(JSON.parse(raw));
      return;
    }
  } catch (error) {
    console.error('读取 data.json 失败：', error);
  }
  saveData();
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (error) {
    console.error('保存 data.json 失败：', error);
  }
}

loadData();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/data', (req, res) => {
  res.json(store);
});

io.on('connection', (socket) => {
  socket.emit('init', store);

  socket.on('update', (data) => {
    const newStore = safeStore(data);
    store = newStore;
    saveData();
    socket.broadcast.emit('update', store);
  });
});

server.listen(PORT, () => {
  console.log(`备忘录服务已启动：http://localhost:${PORT}`);
});
