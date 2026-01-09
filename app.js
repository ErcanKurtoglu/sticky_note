const config = {
  baseUrl: "https://tznmhdzsysuavvcsolpj.supabase.co/rest/v1",
  token: "sb_publishable_dGsNuj9LEJALW3o1wdsLaQ_aOKEIG1O",
  moduleName: "notes",
};

const board = document.getElementById("board");
const newNoteBtn = document.getElementById("new-note-btn");
const drawer = document.getElementById("drawer");
const drawerClose = document.getElementById("drawer-close");
const editForm = document.getElementById("edit-form");
const titleInput = document.getElementById("note-title");
const contentInput = document.getElementById("note-content");
const widthInput = document.getElementById("note-width");
const heightInput = document.getElementById("note-height");
const rotationInput = document.getElementById("note-rotation");
const opacityInput = document.getElementById("note-opacity");
const colorPicker = document.getElementById("color-picker");
const toast = document.getElementById("toast");

const COLORS = ["#fce7f3", "#fef9c3", "#dcfce7", "#dbeafe", "#ede9fe"];

let notes = [];
let activeNoteId = null;
let draggingNote = null;
let dragOffset = { x: 0, y: 0 };
let savePositionTimer = null;

function buildUrl(path = "", query = "") {
  const trimmedBase = config.baseUrl.replace(/\/$/, "");
  const trimmedPath = path.replace(/^\//, "");
  const queryString = query ? `?${query}` : "";
  return `${trimmedBase}/${trimmedPath}${queryString}`;
}

async function request(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (config.token) {
    headers.Authorization = `Bearer ${config.token}`;
    headers.apikey = config.token;
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "İstek başarısız");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listNotes() {
  const tablePath = config.moduleName;
  return request(buildUrl(tablePath, "select=*"));
}

async function createNote(payload) {
  const tablePath = config.moduleName;
  return request(buildUrl(tablePath), {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Prefer: "return=representation",
    },
  });
}

async function updateNote(id, patch) {
  const tablePath = config.moduleName;
  return request(buildUrl(tablePath, `id=eq.${id}`), {
    method: "PATCH",
    body: JSON.stringify(patch),
    headers: {
      Prefer: "return=representation",
    },
  });
}

async function deleteNote(id) {
  const tablePath = config.moduleName;
  return request(buildUrl(tablePath, `id=eq.${id}`), {
    method: "DELETE",
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function renderNotes() {
  board.textContent = "";
  notes.forEach((note) => {
    const noteEl = document.createElement("div");
    noteEl.className = "note";
    noteEl.dataset.id = note.id;
    noteEl.style.left = `${note.x}px`;
    noteEl.style.top = `${note.y}px`;
    noteEl.style.width = `${note.width}px`;
    noteEl.style.height = `${note.height}px`;
    noteEl.style.background = note.color;
    noteEl.style.transform = `rotate(${note.rotation}deg)`;
    noteEl.style.opacity = note.opacity;

    const header = document.createElement("div");
    header.className = "note-header";

    const title = document.createElement("div");
    title.textContent = note.title || "Başlıksız";

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.title = "Düzenle";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openDrawer(note.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.title = "Sil";
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleDelete(note.id);
    });

    actions.append(editBtn, deleteBtn);
    header.append(title, actions);

    const content = document.createElement("div");
    content.className = "note-content";
    content.textContent = note.content || "";

    noteEl.append(header, content);

    noteEl.addEventListener("mousedown", (event) => startDrag(event, note.id));
    noteEl.addEventListener("dblclick", () => openDrawer(note.id));

    board.append(noteEl);
  });
}

function setupColorPicker() {
  colorPicker.textContent = "";
  COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.addEventListener("click", () => {
      setSelectedColor(color);
    });
    colorPicker.append(swatch);
  });
}

function setSelectedColor(color) {
  const swatches = colorPicker.querySelectorAll(".color-swatch");
  swatches.forEach((swatch) => {
    const isSelected = swatch.dataset.color === color;
    swatch.classList.toggle("selected", isSelected);
  });
}

function openDrawer(noteId) {
  activeNoteId = noteId;
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }
  titleInput.value = note.title || "";
  contentInput.value = note.content || "";
  widthInput.value = note.width;
  heightInput.value = note.height;
  rotationInput.value = note.rotation;
  opacityInput.value = note.opacity;
  setSelectedColor(note.color);
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  activeNoteId = null;
}

function startDrag(event, noteId) {
  const note = notes.find((item) => item.id === noteId);
  if (!note) {
    return;
  }
  draggingNote = note;
  const rect = board.getBoundingClientRect();
  dragOffset = {
    x: event.clientX - rect.left - note.x,
    y: event.clientY - rect.top - note.y,
  };
  board.addEventListener("mousemove", onDrag);
  board.addEventListener("mouseup", endDrag);
  board.addEventListener("mouseleave", endDrag);
}

function onDrag(event) {
  if (!draggingNote) {
    return;
  }
  const rect = board.getBoundingClientRect();
  const nextX = event.clientX - rect.left - dragOffset.x;
  const nextY = event.clientY - rect.top - dragOffset.y;
  draggingNote.x = Math.max(0, Math.min(rect.width - draggingNote.width, nextX));
  draggingNote.y = Math.max(0, Math.min(rect.height - draggingNote.height, nextY));
  renderNotes();

  if (savePositionTimer) {
    window.clearTimeout(savePositionTimer);
  }
  savePositionTimer = window.setTimeout(async () => {
    try {
      await updateNote(draggingNote.id, { x: draggingNote.x, y: draggingNote.y });
    } catch (error) {
      showToast("Konum kaydedilemedi");
    }
  }, 300);
}

function endDrag() {
  board.removeEventListener("mousemove", onDrag);
  board.removeEventListener("mouseup", endDrag);
  board.removeEventListener("mouseleave", endDrag);
  draggingNote = null;
}

function getSelectedColor() {
  const selected = colorPicker.querySelector(".color-swatch.selected");
  return selected ? selected.dataset.color : COLORS[0];
}

function getBoardCenter() {
  const rect = board.getBoundingClientRect();
  return {
    x: Math.max(0, rect.width / 2 - 100),
    y: Math.max(0, rect.height / 2 - 100),
  };
}

async function handleCreate() {
  const center = getBoardCenter();
  const payload = {
    title: "Yeni Not",
    content: "",
    x: Math.round(center.x),
    y: Math.round(center.y),
    width: 200,
    height: 200,
    color: COLORS[0],
    rotation: 0,
    opacity: 1,
  };
  try {
    const created = await createNote(payload);
    const createdNote = Array.isArray(created) ? created[0] : created;
    notes = [createdNote, ...notes].filter(Boolean);
    renderNotes();
  } catch (error) {
    showToast("Not oluşturulamadı");
  }
}

async function handleDelete(noteId) {
  try {
    await deleteNote(noteId);
    notes = notes.filter((note) => note.id !== noteId);
    renderNotes();
  } catch (error) {
    showToast("Not silinemedi");
  }
}

async function handleSave(event) {
  event.preventDefault();
  const note = notes.find((item) => item.id === activeNoteId);
  if (!note) {
    return;
  }
  const patch = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    width: Number(widthInput.value),
    height: Number(heightInput.value),
    color: getSelectedColor(),
    rotation: Number(rotationInput.value),
    opacity: Number(opacityInput.value),
  };

  try {
    const updated = await updateNote(note.id, patch);
    const updatedNote = Array.isArray(updated) ? updated[0] : updated;
    notes = notes.map((item) =>
      item.id === note.id ? { ...item, ...(updatedNote || patch) } : item
    );
    renderNotes();
    closeDrawer();
  } catch (error) {
    showToast("Not güncellenemedi");
  }
}

async function init() {
  setupColorPicker();
  setSelectedColor(COLORS[0]);
  try {
    const data = await listNotes();
    notes = Array.isArray(data) ? data : data?.records || [];
    notes = notes.map((note) => ({
      title: "",
      content: "",
      x: 40,
      y: 40,
      width: 200,
      height: 200,
      color: COLORS[0],
      rotation: 0,
      opacity: 1,
      ...note,
    }));
    renderNotes();
  } catch (error) {
    showToast("Notlar yüklenemedi");
  }
}

newNoteBtn.addEventListener("click", handleCreate);
editForm.addEventListener("submit", handleSave);
drawerClose.addEventListener("click", closeDrawer);

init();
