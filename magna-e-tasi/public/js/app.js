const CATEGORIES = {
  tutte: "Tutte",
  antipasti: "Antipasti",
  primi: "Primi",
  secondi: "Secondi",
  contorni: "Contorni",
  dolci: "Dolci",
};

const DIFFICULTY_LABEL = {
  facile: "Facile",
  media: "Media",
  difficile: "Difficile",
};

let recipes = [];
let activeCategory = "tutte";
let searchQuery = "";

const $ = (sel) => document.querySelector(sel);

function totalMinutes(recipe) {
  return (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
}

function formatTime(minutes) {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function matchesSearch(recipe, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [
    recipe.title,
    recipe.description,
    recipe.category,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function getFilteredRecipes() {
  return recipes.filter((r) => {
    const catOk = activeCategory === "tutte" || r.category === activeCategory;
    return catOk && matchesSearch(r, searchQuery);
  });
}

function renderFilters() {
  const container = $("#filters");
  container.innerHTML = Object.entries(CATEGORIES)
    .map(
      ([key, label]) =>
        `<button type="button" class="filter-btn${key === activeCategory ? " active" : ""}" data-category="${key}" role="tab" aria-selected="${key === activeCategory}">${label}</button>`
    )
    .join("");

  container.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderFilters();
      renderGrid();
    });
  });
}

function renderGrid() {
  const filtered = getFilteredRecipes();
  const grid = $("#recipe-grid");
  const empty = $("#empty-state");
  const countEl = $("#result-count");

  countEl.textContent = filtered.length
    ? `${filtered.length} ricett${filtered.length === 1 ? "a" : "e"}`
    : "";

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = filtered
    .map(
      (r) => `
    <article class="recipe-card" tabindex="0" data-id="${r.id}" role="button" aria-label="Apri ricetta ${r.title}">
      <span class="recipe-card-emoji">${r.emoji || "🍽️"}</span>
      <h2>${escapeHtml(r.title)}</h2>
      <p class="recipe-card-desc">${escapeHtml(r.description || "")}</p>
      <div class="recipe-card-meta">
        <span>⏱ ${formatTime(totalMinutes(r))}</span>
        <span>👥 ${r.servings || "?"} porzioni</span>
        <span>📊 ${DIFFICULTY_LABEL[r.difficulty] || r.difficulty || "—"}</span>
      </div>
      <span class="recipe-card-category">${CATEGORIES[r.category] || r.category}</span>
    </article>`
    )
    .join("");

  grid.querySelectorAll(".recipe-card").forEach((card) => {
    const open = () => openModal(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function openModal(id) {
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return;

  $("#modal-emoji").textContent = recipe.emoji || "🍽️";
  $("#modal-title").textContent = recipe.title;
  $("#modal-description").textContent = recipe.description || "";

  $("#modal-meta").innerHTML = `
    <span>⏱ Preparazione: ${formatTime(recipe.prepMinutes)}</span>
    <span>🔥 Cottura: ${formatTime(recipe.cookMinutes)}</span>
    <span>👥 ${recipe.servings} porzioni</span>
    <span>📊 ${DIFFICULTY_LABEL[recipe.difficulty] || recipe.difficulty}</span>
  `;

  $("#modal-tags").innerHTML = (recipe.tags || [])
    .map((t) => `<span>#${escapeHtml(t)}</span>`)
    .join("");

  $("#modal-ingredients").innerHTML = (recipe.ingredients || [])
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("");

  $("#modal-steps").innerHTML = (recipe.steps || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  const modal = $("#recipe-modal");
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  $("#modal-close").focus();
}

function closeModal() {
  const modal = $("#recipe-modal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function loadRecipes() {
  try {
    const res = await fetch("data/recipes.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    recipes = data.recipes || [];
    renderFilters();
    renderGrid();
  } catch (err) {
    console.error("Impossibile caricare le ricette:", err);
    $("#recipe-grid").innerHTML = "";
    $("#empty-state").classList.remove("hidden");
    $("#empty-state p").textContent = "Errore nel caricamento delle ricette.";
  }
}

function init() {
  $("#year").textContent = new Date().getFullYear();

  $("#search").addEventListener("input", (e) => {
    searchQuery = e.target.value.trim();
    renderGrid();
  });

  $("#btn-reset").addEventListener("click", () => {
    searchQuery = "";
    activeCategory = "tutte";
    $("#search").value = "";
    renderFilters();
    renderGrid();
  });

  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-backdrop").addEventListener("click", closeModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#recipe-modal").classList.contains("hidden")) {
      closeModal();
    }
  });

  loadRecipes();
}

init();
