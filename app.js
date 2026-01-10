const config = {
  baseUrl: "https://socket.supsis.live/api/customer/v1/module",
  token: "YOUR_SUPSIS_TOKEN",
  moduleName: "sticky_notes",
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
let draftNote = null;

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

function getRecordsPath() {
  return `${config.moduleName}/records`;
}

async function listNotes() {
  return request(buildUrl(getRecordsPath(), "offset=0&limit=100"));
}

async function createNote(payload) {
  return request(buildUrl(getRecordsPath()), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

async function updateNote(id, patch) {
  return request(buildUrl(`${getRecordsPath()}/${id}`), {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

async function deleteNote(id) {
  return request(buildUrl(`${getRecordsPath()}/${id}`), {
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
      openDrawer(note);
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
    noteEl.addEventListener("dblclick", () => openDrawer(note));

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

function openDrawer(note) {
  activeNoteId = note?.id ?? null;
  titleInput.value = note?.title || "";
  contentInput.value = note?.content || "";
  widthInput.value = note?.width ?? 200;
  heightInput.value = note?.height ?? 200;
  rotationInput.value = note?.rotation ?? 0;
  opacityInput.value = note?.opacity ?? 1;
  setSelectedColor(note?.color ?? COLORS[0]);
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  activeNoteId = null;
  draftNote = null;
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
  const pendingId = draggingNote.id;
  const pendingX = draggingNote.x;
  const pendingY = draggingNote.y;
  savePositionTimer = window.setTimeout(async () => {
    try {
      await updateNote(pendingId, { x: pendingX, y: pendingY });
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
  draftNote = {
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
  openDrawer(draftNote);
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
  const patch = {
    title: titleInput.value.trim(),
    content: contentInput.value.trim(),
    width: Number(widthInput.value),
    height: Number(heightInput.value),
    color: getSelectedColor(),
    rotation: Number(rotationInput.value),
    opacity: Number(opacityInput.value),
  };

  const isCreating = Boolean(draftNote);
  try {
    if (isCreating) {
      const payload = {
        ...draftNote,
        ...patch,
      };
      const created = await createNote(payload);
      const createdNote = created?._id ? { ...created, id: created._id } : created;
      notes = [createdNote, ...notes].filter(Boolean);
    } else {
      const note = notes.find((item) => item.id === activeNoteId);
      if (!note) {
        return;
      }
      const updated = await updateNote(note.id, patch);
      notes = notes.map((item) =>
        item.id === note.id ? { ...item, ...(updated?._id ? updated : patch) } : item
      );
    }
    renderNotes();
    closeDrawer();
  } catch (error) {
    showToast(isCreating ? "Not oluşturulamadı" : "Not güncellenemedi");
  }
}

async function init() {
  setupColorPicker();
  setSelectedColor(COLORS[0]);
  try {
    const data = await listNotes();
    notes = Array.isArray(data) ? data : data?.items || [];
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
      id: note._id ?? note.id,
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
