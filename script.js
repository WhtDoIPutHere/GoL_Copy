let patterns = [];
let filtered = [];

let currentPage = 1;
const pageSize = 50;

let sortKey = "Name";
let sortDir = 1; // 1 = asc, -1 = desc

fetch("patterns.json")
  .then(res => res.json())
  .then(data => {
    patterns = data;
    filtered = data;
    render();
  });

document.getElementById("search").addEventListener("input", () => {
  currentPage = 1;
  applyFilter();
});

function applyFilter() {
  const q = document.getElementById("search").value.toLowerCase();

  filtered = patterns.filter(p =>
    (p.Name || "").toLowerCase().includes(q) ||
    (p.Description || "").toLowerCase().includes(q)
  );

  sortData();
  render();
}

function sortData() {
  filtered.sort((a, b) => {
    let va, vb;

    if (sortKey === "Cells") {
      va = +a.Cells || 0;
      vb = +b.Cells || 0;
    }

    else if (sortKey === "BBox") {
      const areaA = bboxArea(a);
      const areaB = bboxArea(b);
      va = areaA;
      vb = areaB;
    }

    else {
      va = (a[sortKey] || "").toString().toLowerCase();
      vb = (b[sortKey] || "").toString().toLowerCase();
    }

    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });
}

function bboxArea(p) {
  if (!p["Bounding Box"]) return 0;
  const parts = p["Bounding Box"].split("x");
  if (parts.length !== 2) return 0;
  return (+parts[0]) * (+parts[1]);
}

function render() {
  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  const start = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  for (let p of pageItems) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.Name || ""}</td>
      <td class="desc" title="${p.Description || ""}">
        ${p.Description || ""}
      </td>
      <td>${p.Rule || ""}</td>
      <td>${p.Cells || ""}</td>
      <td>${p["Bounding Box"] || ""}</td>
    `;

    body.appendChild(row);
  }

  renderPagination();
}

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

// sorting from header clicks
function sortBy(key) {
  if (sortKey === key) {
    sortDir *= -1;
  } else {
    sortKey = key;
    sortDir = 1;
  }

  applyFilter();
}