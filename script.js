// Global variables for managing the pattern library state
let currentTab = "all"; // Current active tab: "all", "favorites", or "recent"
let patterns = []; // Array of all loaded patterns
let filtered = []; // Filtered patterns based on search and tab
let currentPage = 1; // Current page for pagination
const pageSize = 50; // Number of patterns per page
let sortKey = null; // Current sort column: "Name", "Description", "Rule", "Cells", "BBox"
let sortDir = 0; // Sort direction: 0 = no sort, 1 = ascending, -1 = descending

// Retrieve favorite patterns from localStorage
function getFavorites() {
  return JSON.parse(localStorage.getItem("favorites") || "[]");
}

// Retrieve recently viewed patterns from localStorage
function getRecent() {
  return JSON.parse(localStorage.getItem("recent") || "[]");
}

// Save favorite patterns to localStorage
function saveFavorites(list) {
  localStorage.setItem("favorites", JSON.stringify(list));
}

// Save recently viewed patterns to localStorage
function saveRecent(list) {
  localStorage.setItem("recent", JSON.stringify(list));
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
}

// Load patterns from JSON and initialize the app
fetch("patterns.json")
  .then(res => res.json())
  .then(data => {
    patterns = data;
    filtered = data;
    render();
  });

// Listen for search input changes
document.getElementById("search").addEventListener("input", () => {
  currentPage = 1;
  applyFilter();
});

// Apply search filter and tab selection to patterns
function applyFilter() {
  const q = document.getElementById("search").value.toLowerCase();
  let base = patterns;

  if (currentTab === "favorites") {
    const favs = getFavorites();
    base = patterns.filter(p => favs.includes(p["Pattern File"]));
  }

  if (currentTab === "recent") {
    const rec = getRecent();
    base = rec.map(f => patterns.find(p => p["Pattern File"] === f)).filter(Boolean);
  }

  filtered = base.filter(p =>
    (p.Name || "").toLowerCase().includes(q) ||
    (p.Description || "").toLowerCase().includes(q)
  );

  sortData();
  render();
}

// Sort the filtered patterns based on sortKey and sortDir
function sortData() {
  if (!sortKey || sortDir === 0) return;

  filtered.sort((a, b) => {
    let va, vb;

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
}

// Render the pattern table with pagination
function render() {
  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  updateSortIndicators();

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  for (let p of pageItems) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <span onclick="toggleFavorite('${p["Pattern File"]}')"
              style="cursor:pointer;">
          ${isFavorite(p["Pattern File"]) ? "⭐" : "☆"}
        </span>
      </td>
      <td>
        <a href="gol.html?file=${encodeURIComponent(p["Pattern File"])}"
           onclick="addRecent('${p["Pattern File"]}')"
           style="color:#8ecae6; text-decoration: underline;">
          ${p.Name || ""}
        </a>
      </td>
      <td class="desc" title="${p.Description || " "}">
        ${p.Description || " "}
      </td>
      <td><span class="rule">${p.Rule || ""}</span></td>
      <td class="num">${p.Cells || ""}</td>
      <td><span class="bbox">${p["Bounding Box"] || ""}</span></td>
    `;

    body.appendChild(row);
  }

  renderPagination();
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