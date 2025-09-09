// app.js — externalized JavaScript

const editor = document.getElementById('editor');
const usernameInput = document.getElementById('username');
const connectBtn = document.getElementById('connect-btn');
const status = document.getElementById('status');
const usersDiv = document.getElementById('users');

let ws;
const userId = Math.random().toString(36).substr(2, 9); // Unique ID for each client
const userColor = '#' + Math.floor(Math.random()*16777215).toString(16); // Random color for cursor
let connectedUsers = new Set();

connectBtn.addEventListener('click', () => {
  const username = usernameInput.value || 'Anonymous';
  if (!username) {
    alert('Please enter a username');
    return;
  }
  connect(username);
});

function connect(username) {
  // NOTE: wss://echo.websocket.org was a public echo server previously used for demos,
  // but it is not reliable/available in many environments. Replace the URL below with
  // your own server (e.g., ws://localhost:8080 or wss://your-domain.com).
  const WS_URL = 'wss://echo.websocket.org'; // <<-- Replace this with your actual server

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    status.textContent = 'Connected';
    status.className = 'mt-2 text-sm text-green-500';
    ws.send(JSON.stringify({ type: 'join', userId, username, color: userColor }));
    connectedUsers.add(userId);
    updateUsers();
  };

  ws.onmessage = (event) => {
    // Some public/demo servers echo your own messages back. Code below handles both echoed and real broadcast messages.
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (e) {
      // non-JSON message — ignore
      return;
    }

    if (data.type === 'update') {
      if (data.userId !== userId) {
        editor.innerHTML = data.content;
        if (data.cursor) {
          updateRemoteCursor(data.userId, data.cursor, data.color);
        }
      }
    } else if (data.type === 'join' || data.type === 'leave') {
      if (data.userId !== userId) {
        if (data.type === 'join') {
          connectedUsers.add(data.userId);
        } else {
          connectedUsers.delete(data.userId);
          removeRemoteCursor(data.userId);
        }
        updateUsers();
      }
    } else {
      // Handle echoes from echo server: if we get our own join/update back, treat as harmless.
      // If using a real broadcast server you'll get proper join/update messages from other clients.
    }
  };

  ws.onclose = () => {
    status.textContent = 'Disconnected';
    status.className = 'mt-2 text-sm text-red-500';
    connectedUsers.clear();
    updateUsers();
  };

  ws.onerror = (error) => {
    status.textContent = 'Error: ' + (error?.message || 'WebSocket error');
    status.className = 'mt-2 text-sm text-red-500';
  };
}

// Throttle to limit emit frequency
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

editor.addEventListener('input', throttle(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const content = editor.innerHTML;
    const selection = window.getSelection();
    let cursorPos = 0;
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(editor);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPos = preCaretRange.toString().length;
    }
    // cursor position simplified; a real app would map offset -> DOM coords
    ws.send(JSON.stringify({
      type: 'update',
      userId,
      content,
      cursor: { x: 0, y: 0 },
      color: userColor
    }));
  }
}, 100));

function updateUsers() {
  // +1 for self if connected
  const count = (ws && ws.readyState === WebSocket.OPEN) ? connectedUsers.size : 0;
  usersDiv.textContent = `Connected: ${count} users`;
}

function updateRemoteCursor(userId, cursor, color) {
  let cursorEl = document.getElementById(`cursor-${userId}`);
  if (!cursorEl) {
    cursorEl = document.createElement('div');
    cursorEl.id = `cursor-${userId}`;
    cursorEl.className = 'user-cursor';
    cursorEl.style.borderColor = color;
    document.body.appendChild(cursorEl);
  }
  cursorEl.style.left = (cursor.x || 100) + 'px';
  cursorEl.style.top = (cursor.y || 100) + 'px';
}

function removeRemoteCursor(userId) {
  const cursorEl = document.getElementById(`cursor-${userId}`);
  if (cursorEl) {
    cursorEl.remove();
  }
}
