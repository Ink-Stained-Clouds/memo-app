const socket = io();
let state = { tasks: [] };

const taskList = document.getElementById('task-list');
const taskInput = document.getElementById('task-input');
const addTaskButton = document.getElementById('add-task-button');
const statusNode = document.getElementById('status');
const reminderBanner = document.getElementById('reminder-banner');
const dismissReminder = document.getElementById('dismiss-reminder');

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function syncState(newState) {
  state = newState && Array.isArray(newState.tasks) ? newState : { tasks: [] };
  render();
}

function sendUpdate() {
  socket.emit('update', state);
}

function updateStatus(text, online = true) {
  statusNode.textContent = text;
  statusNode.className = online ? 'status online' : 'status offline';
}

function render() {
  taskList.innerHTML = '';

  if (state.tasks.length === 0) {
    taskList.innerHTML = '<div class="empty">当前没有任务，试试添加一个吧。</div>';
    return;
  }

  state.tasks.forEach((task) => {
    const taskCard = document.createElement('div');
    taskCard.className = 'task-card';
    if (task.completed) taskCard.classList.add('completed');

    taskCard.innerHTML = `
      <div class="task-header">
        <label class="checkbox-label">
          <input type="checkbox" data-task-id="${task.id}" ${task.completed ? 'checked' : ''} />
          <span class="task-title">${escapeHtml(task.title)}</span>
        </label>
        <button class="delete-task" data-task-id="${task.id}">删除</button>
      </div>
      <div class="subtask-list"></div>
      <div class="subtask-controls">
        <input class="subtask-input" type="text" placeholder="添加子任务" data-task-id="${task.id}" />
        <button class="add-subtask" data-task-id="${task.id}">添加</button>
      </div>
    `;

    const subtaskList = taskCard.querySelector('.subtask-list');
    if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      task.subtasks.forEach((subtask) => {
        const subtaskItem = document.createElement('div');
        subtaskItem.className = 'subtask-item';
        if (subtask.completed) subtaskItem.classList.add('completed');

        subtaskItem.innerHTML = `
          <label class="checkbox-label">
            <input type="checkbox" data-task-id="${task.id}" data-subtask-id="${subtask.id}" ${subtask.completed ? 'checked' : ''} />
            <span class="subtask-title">${escapeHtml(subtask.title)}</span>
          </label>
          <button class="delete-subtask" data-task-id="${task.id}" data-subtask-id="${subtask.id}">删除</button>
        `;
        subtaskList.appendChild(subtaskItem);
      });
    }

    attachTaskEvents(taskCard);
    taskList.appendChild(taskCard);
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attachTaskEvents(card) {
  const checkbox = card.querySelector('input[type="checkbox"][data-task-id]');
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      const taskId = checkbox.dataset.taskId;
      const task = state.tasks.find((item) => item.id === taskId);
      if (task) {
        task.completed = checkbox.checked;
        sendUpdate();
        render();
      }
    });
  }

  const deleteTaskButton = card.querySelector('.delete-task');
  if (deleteTaskButton) {
    deleteTaskButton.addEventListener('click', () => {
      const taskId = deleteTaskButton.dataset.taskId;
      state.tasks = state.tasks.filter((item) => item.id !== taskId);
      sendUpdate();
      render();
    });
  }

  const addSubtaskButton = card.querySelector('.add-subtask');
  const subtaskInput = card.querySelector('.subtask-input');
  if (addSubtaskButton && subtaskInput) {
    addSubtaskButton.addEventListener('click', () => {
      const taskId = addSubtaskButton.dataset.taskId;
      const task = state.tasks.find((item) => item.id === taskId);
      const title = subtaskInput.value.trim();
      if (task && title) {
        task.subtasks = task.subtasks || [];
        task.subtasks.push({ id: uniqueId(), title, completed: false });
        subtaskInput.value = '';
        sendUpdate();
        render();
      }
    });

    subtaskInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') addSubtaskButton.click();
    });
  }

  const subtaskCheckboxes = card.querySelectorAll('input[type="checkbox"][data-subtask-id]');
  subtaskCheckboxes.forEach((subtaskCheckbox) => {
    subtaskCheckbox.addEventListener('change', () => {
      const taskId = subtaskCheckbox.dataset.taskId;
      const subtaskId = subtaskCheckbox.dataset.subtaskId;
      const task = state.tasks.find((item) => item.id === taskId);
      if (task && Array.isArray(task.subtasks)) {
        const subtask = task.subtasks.find((item) => item.id === subtaskId);
        if (subtask) {
          subtask.completed = subtaskCheckbox.checked;
          sendUpdate();
          render();
        }
      }
    });
  });

  const deleteSubtaskButtons = card.querySelectorAll('.delete-subtask');
  deleteSubtaskButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const taskId = button.dataset.taskId;
      const subtaskId = button.dataset.subtaskId;
      const task = state.tasks.find((item) => item.id === taskId);
      if (task && Array.isArray(task.subtasks)) {
        task.subtasks = task.subtasks.filter((item) => item.id !== subtaskId);
        sendUpdate();
        render();
      }
    });
  });
}

addTaskButton.addEventListener('click', () => {
  const title = taskInput.value.trim();
  if (!title) return;
  state.tasks.push({ id: uniqueId(), title, completed: false, subtasks: [] });
  taskInput.value = '';
  sendUpdate();
  render();
});

taskInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') addTaskButton.click();
});

dismissReminder.addEventListener('click', () => {
  reminderBanner.classList.add('hidden');
});

socket.on('connect', () => {
  updateStatus('已连接，实时同步在线。', true);
});

socket.on('disconnect', () => {
  updateStatus('已断开连接，离线模式。', false);
});

socket.on('init', (data) => {
  syncState(data);
});

socket.on('update', (data) => {
  syncState(data);
});

function showReminder() {
  reminderBanner.classList.remove('hidden');
  if (Notification.permission === 'granted') {
    new Notification('整点提醒', {
      body: '该检查你的备忘录并完成今天的任务了。',
      icon: '/favicon.png'
    });
  }
}

function scheduleNextReminder() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 100);
  const delay = next - now;
  setTimeout(() => {
    showReminder();
    scheduleNextReminder();
  }, delay);
}

let notificationRequested = false;

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(() => {
      notificationRequested = true;
    }).catch(() => {
      notificationRequested = true;
    });
  } else {
    notificationRequested = true;
  }
}

window.addEventListener('load', () => {
  requestNotificationPermission();
  scheduleNextReminder();
});

window.addEventListener('focus', () => {
  if (!notificationRequested) {
    requestNotificationPermission();
  }
});
