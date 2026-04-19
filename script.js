let patterns = [];
let filtered = [];

fetch("patterns.json")
  .then(res => res.json())
  .then(data => {
    patterns = data;
    filtered = data;
    renderTable();
  });

const search = document.getElementById("search");

search.addEventListener("input", () => {
  const q = search.value.toLowerCase();

  filtered = patterns.filter(p =>
    (p.Name || "").toLowerCase().includes(q) ||
    (p.Description || "").toLowerCase().includes(q)
  );

  renderTable();
});

function renderTable() {
  const body = document.getElementById("tableBody");
  body.innerHTML = "";

  for (let p of filtered) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.Name || ""}</td>
      <td class="small">${p.Description || ""}</td>
      <td>${p.Rule || ""}</td>
      <td>${p.Cells || ""}</td>
      <td>${p["Bounding Box"] || ""}</td>
    `;

    body.appendChild(row);
  }
}
