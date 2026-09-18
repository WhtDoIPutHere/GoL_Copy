// Global variables for managing the pattern library state
let currentTab = "all"; // Current active tab: "all", "favorites", "recent", "custom", or "color-presets"
let patterns = []; // Array of all loaded patterns
let filtered = []; // Filtered patterns based on search and tab
let currentPage = 1; // Current page for pagination
const pageSize = 50; // Number of patterns per page
let sortKey = null; // Current sort column: "Name", "Description", "Rule", "Cells", "BBox"
let sortDir = 0; // Sort direction: 0 = no sort, 1 = ascending, -1 = descending
const COLOR_PRESET_STORAGE_KEY = "colorPresets";
const HEATMAP_PRESET_STORAGE_KEY = "heatmapColorPresets";
const DEFAULT_HEATMAP_PRESET = {
  id: "default-heatmap-preset",
  type: "heatmap",
  name: "Default Heatmap",
  description: "Current default heatmap gradient and aging speed.",
  startColor: "#3cb4dc",
  endColor: "#f02846",
  duration: 20
};
const DEFAULT_COLOR_CYCLE_PRESET = {
  id: "default-color-cycle-preset",
  type: "color-cycle",
  name: "Default Colors",
  description: "Current default age-color cycle.",
  stages: ["#9ddc15", "#ffd539", "#f58f20", "#ca204d"],
  loop: false
};

function readStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error);
    try {
      localStorage.removeItem(key);
    } catch {}
    return [];
  }
}

function writeStoredArray(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage`, error);
  }
}

function getCustomPatterns() {
  return readStoredArray("customPatterns");
}

function getColorPresets() {
  const list = readStoredArray(COLOR_PRESET_STORAGE_KEY);
  if (list.length) return list;
  const legacyHeatmap = readStoredArray(HEATMAP_PRESET_STORAGE_KEY);
  if (legacyHeatmap.length) {
    saveColorPresets(legacyHeatmap);
    return legacyHeatmap;
  }
  return [];
}

function saveColorPresets(list) {
  writeStoredArray(COLOR_PRESET_STORAGE_KEY, list);
}

function getHeatmapColorPresets() {
  return getColorPresets().filter(p => p.type === "heatmap" || (p.startColor && p.endColor));
}

function getAgeColorPresets() {
  return getColorPresets().filter(p => p.type === "color-cycle" || Array.isArray(p.stages));
}

function saveHeatmapColorPresets(list) {
  const current = getColorPresets();
  const others = current.filter(p => p.type !== "heatmap" && !(p.startColor && p.endColor));
  saveColorPresets([...others, ...list]);
}

function ensureDefaultHeatmapPreset() {
  const list = getColorPresets();
  const hasHeatmap = list.some(p => p.type === "heatmap" || (p.startColor && p.endColor));
  const hasCycle = list.some(p => p.type === "color-cycle" || Array.isArray(p.stages));

  if (!hasHeatmap || !hasCycle) {
    const merged = [...list];
    if (!hasHeatmap) merged.unshift(DEFAULT_HEATMAP_PRESET);
    if (!hasCycle) merged.unshift(DEFAULT_COLOR_CYCLE_PRESET);
    saveColorPresets(merged);
  }
}

function saveCurrentHeatmapPreset(name, startColor, endColor, duration) {
  const cleanName = (name || "Preset").trim() || "Preset";
  const preset = {
    id: `heatmap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "heatmap",
    name: cleanName,
    description: `${startColor} → ${endColor} over ${duration} generations`,
    startColor: String(startColor || DEFAULT_HEATMAP_PRESET.startColor),
    endColor: String(endColor || DEFAULT_HEATMAP_PRESET.endColor),
    duration: Number(duration) || DEFAULT_HEATMAP_PRESET.duration
  };

  const list = getColorPresets();
  const filtered = list.filter(p => !(p.type === "heatmap" || (p.startColor && p.endColor)));
  filtered.unshift(preset);
  saveColorPresets(filtered);
  return preset;
}

function saveCurrentColorCyclePreset(name, stages, loop) {
  const cleanName = (name || "Preset").trim() || "Preset";
  const preset = {
    id: `color-cycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "color-cycle",
    name: cleanName,
    description: `${stages.length} stage${stages.length === 1 ? "" : "s"}${loop ? " • loops" : ""}`,
    stages: stages.map(v => String(v)),
    loop: Boolean(loop)
  };

  const list = getColorPresets();
  const filtered = list.filter(p => !(p.type === "color-cycle" || Array.isArray(p.stages)));
  filtered.unshift(preset);
  saveColorPresets(filtered);
  return preset;
}

function loadHeatmapPresetFromLibrary(preset) {
  const safePreset = preset || DEFAULT_HEATMAP_PRESET;
  if (window.opener && typeof window.opener.loadHeatmapPresetFromLibrary === "function") {
    window.opener.loadHeatmapPresetFromLibrary(safePreset);
    return;
  }

  try {
    localStorage.setItem("pendingHeatmapPreset", JSON.stringify(safePreset));
  } catch (err) {
    console.warn("Failed to persist pending preset", err);
  }
  window.location.href = "index.html";
}

function loadColorCyclePresetFromLibrary(preset) {
  const safePreset = preset || DEFAULT_COLOR_CYCLE_PRESET;
  if (window.opener && typeof window.opener.loadColorCyclePresetFromLibrary === "function") {
    window.opener.loadColorCyclePresetFromLibrary(safePreset);
    return;
  }

  try {
    localStorage.setItem("pendingColorCyclePreset", JSON.stringify(safePreset));
  } catch (err) {
    console.warn("Failed to persist pending color cycle preset", err);
  }
  window.location.href = "index.html";
}

function loadPresetFromLibrary(preset) {
  if (!preset) return;
  if (preset.type === "color-cycle" || Array.isArray(preset.stages)) {
    loadColorCyclePresetFromLibrary(preset);
    return;
  }
  loadHeatmapPresetFromLibrary(preset);
}

const LIBRARY_EXPORT_KEYS = [
  "customPatterns",
  "favorites",
  "recent",
  "colorPresets",
  "heatmapColorPresets",
  "gol-board-states"
];

function readStoredValue(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage`, error);
    return null;
  }
}

function readStoredArraySafe(key) {
  const value = readStoredValue(key);
  return Array.isArray(value) ? value : [];
}

function writeStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write ${key} to localStorage`, error);
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function sanitizeColorValue(value, fallback) {
  const safe = String(value || fallback || "#000000");
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(safe) ? safe : fallback || "#000000";
}

function normalizeImportedObject(item, fallbackFactory) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const normalized = fallbackFactory(item);
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized)) return null;
  return normalized;
}

function normalizeImportedStrings(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const output = [];

  for (const item of list) {
    const value = typeof item === "string" ? item.trim() : "";
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function getStorageIdentity(item) {
  if (!item || typeof item !== "object") return null;

  const keys = ["id", "Pattern File", "Name", "name", "file", "title"];
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && String(item[key]).trim() !== "") {
      return String(item[key]);
    }
  }

  return JSON.stringify(item);
}

function mergeSavedBoardStates(incomingStates) {
  const existingStates = getSavedStateEntriesForExport();
  const normalizedIncoming = Array.isArray(incomingStates) ? incomingStates : [];
  const incomingById = new Map();

  for (const entry of normalizedIncoming) {
    const safeEntry = normalizeImportedObject(entry, (item) => ({
      ...item,
      id: String(item.id || item.name || `imported-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      name: String(item.name || "Saved State").trim() || "Saved State"
    }));

    if (!safeEntry || !safeEntry.state || typeof safeEntry.state !== "object") continue;
    incomingById.set(String(safeEntry.id), safeEntry);
  }

  const merged = [
    ...incomingById.values(),
    ...existingStates.filter(entry => !incomingById.has(String(entry.id || entry.name || "")))
  ];

  writeStoredValue("gol-board-states", merged);
  return merged;
}

function mergeStoredItems(key, incomingItems, getIdentity) {
  const existingItems = readStoredArraySafe(key);
  const normalizedIncoming = Array.isArray(incomingItems) ? incomingItems : [];
  const incomingById = new Map();

  for (const item of normalizedIncoming) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const identity = getIdentity(item);
    if (!identity || String(identity).trim() === "") continue;
    incomingById.set(String(identity), item);
  }

  const merged = [
    ...incomingById.values(),
    ...existingItems.filter(item => {
      const identity = getIdentity(item);
      return identity && !incomingById.has(String(identity));
    })
  ];

  writeStoredValue(key, merged);
  return merged;
}

let exportCooldownUntil = 0;
let exportCooldownTimer = null;
const EXPORT_COOLDOWN_MS = 10000;

function updateExportCooldownButtons() {
  const remaining = Math.max(0, exportCooldownUntil - Date.now());
  const buttons = document.querySelectorAll("#exportLibraryBtn, .row-export-btn, #exportMenu button");
  buttons.forEach(button => {
    button.disabled = remaining > 0;
    if (remaining > 0) {
      button.title = `Export available in ${Math.ceil(remaining / 1000)}s`;
    } else {
      button.removeAttribute("title");
    }
  });
  if (remaining > 0) {
    exportCooldownTimer = window.setTimeout(updateExportCooldownButtons, 250);
  } else {
    exportCooldownTimer = null;
  }
}

function startExportCooldown() {
  exportCooldownUntil = Date.now() + EXPORT_COOLDOWN_MS;
  if (exportCooldownTimer) window.clearTimeout(exportCooldownTimer);
  updateExportCooldownButtons();
}

function downloadJsonFile(filename, data) {
  if (Date.now() < exportCooldownUntil) return false;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  startExportCooldown();
  return true;
}

function exportLibraryData() {
  const payload = {};

  for (const key of LIBRARY_EXPORT_KEYS) {
    const value = readStoredValue(key);
    if (value !== null) {
      payload[key] = value;
    }
  }

  if (!downloadJsonFile("gol-library-export.json", payload)) return null;

  return payload;
}

function getSavedStateEntriesForExport() {
  const states = readStoredValue("gol-board-states");
  if (Array.isArray(states)) return states;
  return [];
}

function exportSavedState(entry) {
  if (!entry || !entry.state) return false;

  const safeName = String(entry.name || "saved-state")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "saved-state";
  if (!downloadJsonFile(`gol-${safeName}.json`, { "gol-board-states": [entry] })) return false;
  closeExportMenu();
  return true;
}

function exportCustomPattern(pattern) {
  if (!pattern) return false;
  const safeName = String(pattern.Name || pattern.name || "custom-pattern")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "custom-pattern";
  return downloadJsonFile(`gol-${safeName}.json`, { customPatterns: [pattern] });
}

function exportColorPreset(preset) {
  if (!preset) return false;
  const safeName = String(preset.name || preset.Name || "color-preset")
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "color-preset";
  return downloadJsonFile(`gol-${safeName}.json`, { colorPresets: [preset] });
}

function updateExportMenu() {
  const menu = document.getElementById("exportMenu");
  if (!menu) return;

  menu.innerHTML = "";

  const exportAllButton = document.createElement("button");
  exportAllButton.type = "button";
  exportAllButton.textContent = "Export All Saved";
  exportAllButton.onclick = exportLibraryData;
  menu.appendChild(exportAllButton);

  const states = getSavedStateEntriesForExport();
  const label = document.createElement("div");
  label.className = "export-menu-label";
  label.textContent = states.length ? "Export a saved state" : "No saved states";
  menu.appendChild(label);

  states.forEach((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = entry.name || "Saved State";
    button.onclick = () => exportSavedState(entry);
    menu.appendChild(button);
  });
}

function toggleExportMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById("exportMenu");
  if (!menu) return;

  if (menu.style.display === "block") {
    closeExportMenu();
    return;
  }

  updateExportMenu();
  menu.style.display = "block";
}

function closeExportMenu() {
  const menu = document.getElementById("exportMenu");
  if (menu) menu.style.display = "none";
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".export-dropdown")) closeExportMenu();
});

function importLibraryData(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Import data must be a JSON object.");
  }

  const entries = Object.keys(data);
  if (!entries.length) {
    throw new Error("The import file is empty.");
  }

  for (const key of LIBRARY_EXPORT_KEYS) {
    if (data[key] === undefined) continue;
    const incoming = data[key];
    if (key === "gol-board-states" || key === "customPatterns" || key === "colorPresets" || key === "heatmapColorPresets") {
      continue;
    }
    if (Array.isArray(incoming)) {
      writeStoredValue(key, normalizeImportedStrings(incoming));
    } else if (key === "gol-board-states" && incoming && typeof incoming === "object") {
      writeStoredValue(key, [incoming]);
    }
  }

  if (data.colorPresets && Array.isArray(data.colorPresets)) {
    mergeStoredItems("colorPresets", data.colorPresets, item => getStorageIdentity(item));
  }

  if (data.heatmapColorPresets && Array.isArray(data.heatmapColorPresets)) {
    const mergedHeatmaps = mergeStoredItems("colorPresets", data.heatmapColorPresets, item => getStorageIdentity(item));
    saveHeatmapColorPresets(mergedHeatmaps.filter(item => item && typeof item === "object" && (item.type === "heatmap" || (item.startColor && item.endColor))));
  }

  if (data.customPatterns && Array.isArray(data.customPatterns)) {
    mergeStoredItems("customPatterns", data.customPatterns, item => getStorageIdentity(item));
  }

  if (data.favorites && Array.isArray(data.favorites)) {
    saveFavorites(normalizeImportedStrings(data.favorites));
  }

  if (data.recent && Array.isArray(data.recent)) {
    saveRecent(normalizeImportedStrings(data.recent));
  }

  if (data["gol-board-states"] && Array.isArray(data["gol-board-states"])) {
    mergeSavedBoardStates(data["gol-board-states"]);
  }

  alert("Saved data imported successfully.");
  window.location.reload();
}

async function handleLibraryImportFile(event) {
  const file = event.target && event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    importLibraryData(parsed);
  } catch (error) {
    console.error(error);
    alert(`Import failed: ${error.message || "Invalid JSON file."}`);
  } finally {
    event.target.value = "";
  }
}

function saveCustomPatterns(list) {
  writeStoredArray("customPatterns", list);
}

function addCustomPattern(pattern) {
  const list = getCustomPatterns();
  list.unshift(pattern);
  saveCustomPatterns(list);
}

function getAllPatterns() {
  return [...patterns, ...getCustomPatterns()];
}

// Retrieve favorite patterns from localStorage
function getFavorites() {
  return readStoredArray("favorites");
}

// Retrieve recently viewed patterns from localStorage
function getRecent() {
  return readStoredArray("recent");
}

// Save favorite patterns to localStorage
function saveFavorites(list) {
  writeStoredArray("favorites", normalizeImportedStrings(list));
}

// Save recently viewed patterns to localStorage
function saveRecent(list) {
  writeStoredArray("recent", normalizeImportedStrings(list));
}

// Check if a pattern file is marked as favorite
function isFavorite(file) {
  return getFavorites().includes(file);
}

// Toggle favorite status for a pattern file
function toggleFavorite(file) {
  let favs = getFavorites();
  if (favs.includes(file)) {
    favs = favs.filter(f => f !== file); // Remove from favorites
  } else {
    favs.push(file); // Add to favorites
  }
  saveFavorites(favs);
  render(); // Re-render the table
}

// Add a pattern to the recent list
function addRecent(file) {
  let recent = getRecent();
  recent = recent.filter(f => f !== file); // Remove if already exists
  recent.unshift(file); // Add to front
  if (recent.length > 50) {
    recent.pop(); // Limit to 50 items
  }
  saveRecent(recent);
}

// Set the active tab and reset pagination
function setTab(tab) {
  currentTab = tab;
  currentPage = 1;
  applyFilter();

  const tabs = ["tab-all", "tab-recent", "tab-favorites", "tab-custom", "tab-color-presets"];
  for (const id of tabs) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("active", id === `tab-${tab}`);
  }
}

// Load patterns from JSON and initialize the app
ensureDefaultHeatmapPreset();
fetch("patterns.json")
  .then(res => res.json())
  .then(data => {
    patterns = data;
    setTab(currentTab);
  });

// Listen for search input changes
document.getElementById("search").addEventListener("input", () => {
  currentPage = 1;
  applyFilter();
});

// Apply search filter and tab selection to patterns
function applyFilter() {
  const q = document.getElementById("search").value.toLowerCase();
  let base = getAllPatterns();

  if (currentTab === "custom") {
    base = getCustomPatterns();
  } else if (currentTab === "favorites") {
    const favs = getFavorites();
    base = getAllPatterns().filter(p => favs.includes(p["Pattern File"]));
  } else if (currentTab === "recent") {
    const rec = getRecent();
    base = rec.map(id => getAllPatterns().find(p => p["Pattern File"] === id)).filter(Boolean);
  } else if (currentTab === "color-presets") {
    base = getColorPresets();
  }

  filtered = base.filter(p =>
    (p.Name || p.name || "").toLowerCase().includes(q) ||
    (p.Description || p.description || "").toLowerCase().includes(q)
  );

  sortData();
  render();
}

// Sort the filtered patterns based on sortKey and sortDir
function sortData() {
  if (!sortKey || sortDir === 0) return;

  filtered.sort((a, b) => {
    let va, vb;

    if (currentTab === "color-presets") {
      if (sortKey === "Name") {
        va = (a.name || a.Name || "").toString().toLowerCase();
        vb = (b.name || b.Name || "").toString().toLowerCase();
      } else if (sortKey === "Description") {
        va = (a.description || a.Description || "").toString().toLowerCase();
        vb = (b.description || b.Description || "").toString().toLowerCase();
      } else {
        va = (a[sortKey] || "").toString().toLowerCase();
        vb = (b[sortKey] || "").toString().toLowerCase();
      }
    } else {
      if (sortKey === "Cells") {
        va = +a.Cells || 0;
        vb = +b.Cells || 0;
      } else if (sortKey === "BBox") {
        va = bboxArea(a);
        vb = bboxArea(b);
      } else {
        va = (a[sortKey] || "").toString().toLowerCase();
        vb = (b[sortKey] || "").toString().toLowerCase();
      }
    }

    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });
}

// Calculate the area of a pattern's bounding box
function bboxArea(p) {
  if (!p["Bounding Box"]) return 0;
  const parts = p["Bounding Box"].split("x");
  if (parts.length !== 2) return 0;
  return (+parts[0]) * (+parts[1]);
}

// Handle sorting when a table header is clicked
function sortBy(key) {
  if (sortKey === key) {
    if (sortDir === 1) sortDir = -1;
    else if (sortDir === -1) {
      sortKey = null;
      sortDir = 0;
    } else {
      sortDir = 1;
    }
  } else {
    sortKey = key;
    sortDir = 1;
  }
  applyFilter();
}

// Update sort indicators in table headers
function updateSortIndicators() {
  const keys = ["Name", "Description", "Rule", "Cells", "BBox"];
  for (let k of keys) {
    const el = document.getElementById("h-" + k);
    if (!el) continue;

    let label = k === "BBox" ? "Bounding Box" : k;
    if (sortKey === k) {
      if (sortDir === 1) label += " ↑";
      else if (sortDir === -1) label += " ↓";
    }
    el.textContent = label;
  }

  if (currentTab === "color-presets") {
    const nameEl = document.getElementById("h-Name");
    const descEl = document.getElementById("h-Description");
    if (nameEl) nameEl.textContent = sortKey === "Name" ? `Name${sortDir === 1 ? " ↑" : sortDir === -1 ? " ↓" : ""}` : "Name";
    if (descEl) descEl.textContent = sortKey === "Description" ? `Description${sortDir === 1 ? " ↑" : sortDir === -1 ? " ↓" : ""}` : "Description";
  }
}

function applyTableHeaderForCurrentTab() {
  const headRow = document.getElementById("libraryTableHeadRow");
  if (!headRow) return;
  const table = headRow.closest("table");
  if (table) table.classList.toggle("color-presets", currentTab === "color-presets");

  if (currentTab === "color-presets") {
    headRow.innerHTML = `
      <th>Preview</th>
      <th onclick="sortBy('Name')" id="h-Name">Name</th>
      <th>Colors</th>
      <th>Mode</th>
      <th>Load</th>
      <th>Export</th>
    `;
    return;
  }

  headRow.innerHTML = `
    <th>Preview</th>
    <th>★</th>
    <th onclick="sortBy('Name')" id="h-Name">Name</th>
    <th onclick="sortBy('Description')" id="h-Description">Description</th>
    <th>RLE</th>
    <th onclick="sortBy('Rule')" id="h-Rule">Rule</th>
    <th onclick="sortBy('Cells')" id="h-Cells">Cells</th>
    <th onclick="sortBy('BBox')" id="h-BBox">Bounding Box</th>
    <th>Load</th>
    ${currentTab === "custom" ? "<th>Export</th>" : ""}
  `;
}

// Render the pattern table with pagination
async function render() {
  const body = document.getElementById("tableBody");
  body.innerHTML = "";
  applyTableHeaderForCurrentTab();

  updateSortIndicators();

  const pagination = document.getElementById("pagination");
  if (pagination) {
    pagination.innerHTML = currentTab === "color-presets" ? "" : pagination.innerHTML;
  }

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  if (currentTab === "color-presets") {
    for (let p of pageItems) {
      const row = document.createElement("tr");
      const isCycle = p.type === "color-cycle" || Array.isArray(p.stages);
      const sanitizedStages = Array.isArray(p.stages)
        ? p.stages.map(color => sanitizeColorValue(color, "#9ddc15"))
        : ["#9ddc15", "#ffd539", "#f58f20", "#ca204d"];
      const safeStart = sanitizeColorValue(p.startColor, "#9ddc15");
      const safeEnd = sanitizeColorValue(p.endColor, "#ca204d");
      const gradient = isCycle
        ? `linear-gradient(90deg, ${sanitizedStages.join(", ")})`
        : `linear-gradient(90deg, ${safeStart}, ${safeEnd})`;
      const stageText = isCycle ? sanitizedStages.join(" → ") : `${safeStart} → ${safeEnd}`;
      const modeText = isCycle ? (p.loop ? "Loop" : "No loop") : `${p.duration || ""} gen`;
      row.innerHTML = `
        <td><div style="width:70px;height:50px;border:1px solid #333;background:${escapeHtml(gradient)};"></div></td>
        <td>${escapeHtml(p.name || p.Name || "")}</td>
        <td><span style="color:#8ecae6;font-family:monospace;">${escapeHtml(stageText)}</span></td>
        <td><span style="color:#8ecae6;font-family:monospace;">${escapeHtml(modeText)}</span></td>
        <td><button type="button" class="load-preset-btn">Load</button></td>
        <td><button type="button" class="row-export-btn">Export</button></td>
      `;
      const loadButton = row.querySelector(".load-preset-btn");
      if (loadButton) {
        loadButton.addEventListener("click", () => loadPresetFromLibrary(p));
      }
      const exportButton = row.querySelector(".row-export-btn");
      if (exportButton) {
        exportButton.addEventListener("click", () => exportColorPreset(p));
      }
      body.appendChild(row);
    }
    updateExportCooldownButtons();
    return;
  }

  for (let p of pageItems) {
    const fileId = p["Pattern File"];
    const isCustom = fileId && fileId.startsWith("custom:");
    const link = isCustom ? `index.html?custom=${encodeURIComponent(fileId.slice(7))}` : `index.html?file=${encodeURIComponent(fileId)}`;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td><canvas width="70" height="50" style="border: 1px solid #333;"></canvas></td>
      <td>
        <span onclick="toggleFavorite(${JSON.stringify(fileId)})" style="cursor:pointer;">
          ${isFavorite(fileId) ? "⭐" : "☆"}
        </span>
      </td>
      <td>
        <a href="${link}" onclick="addRecent(${JSON.stringify(fileId)})" style="color:#8ecae6; text-decoration: underline;">
          ${escapeHtml(p.Name || "")}
        </a>
      </td>
      <td class="desc" title="${escapeHtml(p.Description || " ")}">
        ${escapeHtml(p.Description || " ")}
      </td>
      <td class="rle">
        <a href="${isCustom ? `rle.html?custom=${encodeURIComponent(fileId.slice(7))}` : `rle.html?file=${encodeURIComponent(fileId)}`}" class="rle-link">View</a>
      </td>
      <td><span class="rule">${escapeHtml(p.Rule || "")}</span></td>
      <td class="num">${escapeHtml(p.Cells || "")}</td>
      <td><span class="bbox">${escapeHtml(p["Bounding Box"] || "")}</span></td>
      <td><button type="button" class="load-pattern-btn">Load</button></td>
      ${currentTab === "custom" ? '<td><button type="button" class="row-export-btn">Export</button></td>' : ""}
    `;

    body.appendChild(row);

    const loadButton = row.querySelector(".load-pattern-btn");
    if (loadButton) {
      loadButton.addEventListener("click", () => {
        addRecent(fileId);
        window.location.href = link;
      });
    }
    const exportButton = row.querySelector(".row-export-btn");
    if (exportButton) {
      exportButton.addEventListener("click", () => exportCustomPattern(p));
    }
    
    // Render preview after adding to DOM
    const canvas = row.querySelector('canvas');
    renderPreview(canvas, p);
  }

  renderPagination();
  updateExportCooldownButtons();
}

// Render pagination buttons
function renderPagination() {
  const totalPages = Math.ceil(filtered.length / pageSize);
  const container = document.getElementById("pagination");

  container.innerHTML = "";

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => {
      currentPage = i;
      render();
    };
    container.appendChild(btn);
  }
}

// Parse RLE format into array of [x,y] coordinates
function parseRLE(rle) {
  // Clean input: remove comments, headers, and whitespace
  rle = rle
    .split("\n")
    .filter(line => 
      !line.startsWith("#") &&     // remove comments
      !line.startsWith("x")        // remove header
    )
    .join("")
    .replace(/\s+/g, "");          // remove whitespace

  let cells = [];
  let x = 0, y = 0;
  let count = "";

  for (let i = 0; i < rle.length; i++) {
    let c = rle[i];

    if (!isNaN(c)) {
      count += c;
      continue;
    }

    let num = count ? parseInt(count) : 1;
    count = "";

    if (c === "o") {
      for (let j = 0; j < num; j++) {
        cells.push([x + j, y]);
      }
      x += num;
    }

    else if (c === "b") {
      x += num;
    }

    else if (c === "$") {
      y += num;
      x = 0;
    }

    else if (c === "!") {
      break;
    }
  }

  return cells;
}

// Render a pattern preview on a canvas
async function renderPreview(canvas, pattern) {
  try {
    let cells = null;

    if (pattern.cells) {
      cells = pattern.cells;
    } else {
      const response = await fetch(`patterns/${pattern["Pattern File"]}`);
      if (!response.ok) return;
      
      const rleText = await response.text();
      cells = parseRLE(rleText);
    }

    if (!cells || cells.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Find bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let [x, y] of cells) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    // Scale to fit canvas
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;
    
    ctx.fillStyle = 'lime'; // Cell green color
    for (let [x, y] of cells) {
      const px = offsetX + (x - minX) * scale;
      const py = offsetY + (y - minY) * scale;
      ctx.fillRect(px, py, scale, scale);
    }
  } catch (e) {
    // Silently fail for previews
  }
}