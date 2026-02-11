const monthLabel = document.getElementById('monthLabel');
const calendarGrid = document.getElementById('calendarGrid');
const selectedDateLabel = document.getElementById('selectedDateLabel');
const taskList = document.getElementById('taskList');
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const noteInput = document.getElementById('noteInput');
const taskItemTemplate = document.getElementById('taskItemTemplate');

const workForm = document.getElementById('workForm');
const workTitleInput = document.getElementById('workTitleInput');
const workOwnerInput = document.getElementById('workOwnerInput');
const workStartInput = document.getElementById('workStartInput');
const workEndInput = document.getElementById('workEndInput');
const workProgressInput = document.getElementById('workProgressInput');
const ganttBody = document.getElementById('ganttBody');
const ganttEmpty = document.getElementById('ganttEmpty');

const state = {
  viewDate: new Date(),
  selectedDateKey: toDateKey(new Date()),
  tasksByDate: load('calendarTasks'),
  works: load('calendarWorks'),
};

renderCalendar();
renderTasks();
renderGantt();

function toDateKey(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? (key === 'calendarWorks' ? [] : {});
  } catch {
    return key === 'calendarWorks' ? [] : {};
  }
}

function save() {
  localStorage.setItem('calendarTasks', JSON.stringify(state.tasksByDate));
  localStorage.setItem('calendarWorks', JSON.stringify(state.works));
}

function updateSelectedDateLabel() {
  const date = fromDateKey(state.selectedDateKey);
  selectedDateLabel.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日のやること`;
}

function renderCalendar() {
  calendarGrid.innerHTML = '';
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  monthLabel.textContent = `${year}年 ${month + 1}月`;

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push(createDayCell(new Date(year, month - 1, prevMonthDays - i), true));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(createDayCell(new Date(year, month, day), false));
  }
  while (cells.length % 7 !== 0) {
    const day = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push(createDayCell(new Date(year, month + 1, day), true));
  }
  cells.forEach((cell) => calendarGrid.appendChild(cell));
}

function createDayCell(date, isOtherMonth) {
  const dateKey = toDateKey(date);
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'day';
  if (isOtherMonth) cell.classList.add('other-month');
  if (dateKey === toDateKey(new Date())) cell.classList.add('today');
  if (dateKey === state.selectedDateKey) cell.classList.add('selected');

  const dayNum = document.createElement('span');
  dayNum.className = 'day-num';
  dayNum.textContent = date.getDate();
  cell.appendChild(dayNum);

  if ((state.tasksByDate[dateKey] ?? []).length > 0) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    cell.appendChild(dot);
  }

  cell.addEventListener('click', () => {
    state.selectedDateKey = dateKey;
    state.viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
    renderTasks();
    renderGantt();
  });
  return cell;
}

function renderTasks() {
  updateSelectedDateLabel();
  taskList.innerHTML = '';
  const tasks = state.tasksByDate[state.selectedDateKey] ?? [];

  if (tasks.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'この日のやることはまだありません。';
    taskList.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const node = taskItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector('.task-text').textContent = task.title;
    node.querySelector('.task-note').textContent = task.note || '';
    node.querySelector('.delete-btn').addEventListener('click', () => {
      state.tasksByDate[state.selectedDateKey].splice(index, 1);
      if (state.tasksByDate[state.selectedDateKey].length === 0) {
        delete state.tasksByDate[state.selectedDateKey];
      }
      save();
      renderCalendar();
      renderTasks();
    });
    taskList.appendChild(node);
  });
}

function renderGantt() {
  const year = state.viewDate.getFullYear();
  const month = state.viewDate.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const daysInMonth = monthEnd.getDate();

  const worksThisMonth = state.works
    .map((work, index) => ({ ...work, index }))
    .filter((work) => {
      const start = fromDateKey(work.start);
      const end = fromDateKey(work.end);
      return end >= monthStart && start <= monthEnd;
    });

  ganttBody.innerHTML = '';
  ganttEmpty.style.display = worksThisMonth.length === 0 ? 'block' : 'none';

  worksThisMonth.forEach((work) => {
    const start = fromDateKey(work.start);
    const end = fromDateKey(work.end);
    const clippedStart = start < monthStart ? monthStart : start;
    const clippedEnd = end > monthEnd ? monthEnd : end;

    const startDay = clippedStart.getDate();
    const endDay = clippedEnd.getDate();
    const daySpan = Math.max(1, endDay - startDay + 1);
    const leftPct = ((startDay - 1) / daysInMonth) * 100;
    const widthPct = (daySpan / daysInMonth) * 100;

    const row = document.createElement('div');
    row.className = 'gantt-row';

    const meta = document.createElement('div');
    meta.className = 'gantt-meta';
    meta.innerHTML = `<strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.owner || '担当未設定')}</small>`;

    const track = document.createElement('div');
    track.className = 'gantt-track';
    track.style.setProperty('--days-in-month', String(daysInMonth));

    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    bar.style.left = `${leftPct}%`;
    bar.style.width = `${widthPct}%`;
    bar.innerHTML = `<span>${startDay}日〜${endDay}日</span><span class="gantt-progress">${Math.min(100, Math.max(0, Number(work.progress) || 0))}%</span>`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'delete-btn';
    removeBtn.textContent = '削除';
    removeBtn.style.position = 'absolute';
    removeBtn.style.right = '0.35rem';
    removeBtn.style.top = '6px';
    removeBtn.addEventListener('click', () => {
      state.works.splice(work.index, 1);
      save();
      renderGantt();
    });

    track.appendChild(bar);
    track.appendChild(removeBtn);
    row.appendChild(meta);
    row.appendChild(track);
    ganttBody.appendChild(row);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.getElementById('prevMonth').addEventListener('click', () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() - 1, 1);
  renderCalendar();
  renderGantt();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + 1, 1);
  renderCalendar();
  renderGantt();
});

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  const note = noteInput.value.trim();
  if (!title) return;
  const list = state.tasksByDate[state.selectedDateKey] ?? [];
  list.push({ title, note });
  state.tasksByDate[state.selectedDateKey] = list;
  save();
  taskInput.value = '';
  noteInput.value = '';
  renderCalendar();
  renderTasks();
});

workForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = workTitleInput.value.trim();
  const owner = workOwnerInput.value.trim();
  const start = workStartInput.value;
  const end = workEndInput.value;
  const progress = Number(workProgressInput.value);

  if (!title || !start || !end) return;
  if (start > end) {
    alert('開始日は終了日より前にしてください。');
    return;
  }

  state.works.push({ title, owner, start, end, progress });
  save();
  workTitleInput.value = '';
  workOwnerInput.value = '';
  workProgressInput.value = '0';
  renderGantt();
});

const installAppBtn = document.getElementById('installAppBtn');
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installAppBtn.hidden = false;
});

installAppBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installAppBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
  installAppBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js');
  });
}
