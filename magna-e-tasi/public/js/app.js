const CATEGORIES = {
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
let activeIndex = 0;
let autoSpinTimer = null;
let userPaused = false;

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

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderOrbit() {
  const orbit = $("#orbit");
  const count = recipes.length;
  if (!count) return;

  const angleStep = 360 / count;
  const radius = Math.min(140, 60 + count * 12);

  orbit.innerHTML = recipes
    .map(
      (r, i) => `
    <button type="button" class="orbit-item${i === activeIndex ? " active" : ""}"
      data-index="${i}"
      style="transform: rotateY(${i * angleStep}deg) translateZ(${radius}px) rotateY(-${i * angleStep}deg)"
      aria-label="${escapeHtml(r.title)}"
      role="listitem">
      <span class="orbit-item-emoji">${r.emoji || "🍽️"}</span>
      <span class="orbit-item-title">${escapeHtml(r.title)}</span>
    </button>`
    )
    .join("");

  orbit.style.transform = `rotateY(${-activeIndex * angleStep}deg)`;

  orbit.querySelectorAll(".orbit-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = Number(item.dataset.index);
      setActiveIndex(idx, true);
      openRecipe(idx);
    });
  });

  renderDots();
}

function renderDots() {
  const dots = $("#bowl-dots");
  dots.innerHTML = recipes
    .map(
      (_, i) =>
        `<button type="button" class="bowl-dot${i === activeIndex ? " active" : ""}" data-index="${i}" role="tab" aria-selected="${i === activeIndex}" aria-label="Ricetta ${i + 1}"></button>`
    )
    .join("");

  dots.querySelectorAll(".bowl-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      setActiveIndex(Number(dot.dataset.index), true);
    });
  });
}

function setActiveIndex(index, pauseAuto = false) {
  if (!recipes.length) return;
  activeIndex = ((index % recipes.length) + recipes.length) % recipes.length;
  if (pauseAuto) userPaused = true;
  renderOrbit();
}

function nextRecipe() {
  setActiveIndex(activeIndex + 1);
}

function prevRecipe() {
  setActiveIndex(activeIndex - 1);
}

function startAutoSpin() {
  stopAutoSpin();
  autoSpinTimer = setInterval(() => {
    if (!userPaused) nextRecipe();
  }, 4000);
}

function stopAutoSpin() {
  if (autoSpinTimer) {
    clearInterval(autoSpinTimer);
    autoSpinTimer = null;
  }
}

function buildVideoElement(recipe) {
  const video = recipe.video;
  if (!video) return null;

  if (video.type === "youtube" && video.id) {
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1`;
    iframe.title = `Video: ${recipe.title}`;
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    return iframe;
  }

  if (video.type === "mp4" && video.src) {
    const el = document.createElement("video");
    el.src = video.src;
    el.controls = true;
    el.playsInline = true;
    el.poster = video.poster || "";
    el.setAttribute("aria-label", `Video: ${recipe.title}`);
    return el;
  }

  return null;
}

function renderVideo(recipe) {
  const frame = $("#video-frame");
  const caption = $("#video-caption");
  frame.innerHTML = "";

  const media = buildVideoElement(recipe);
  if (media) {
    frame.appendChild(media);
    caption.textContent = recipe.video.caption || `Video tutorial — ${recipe.title}`;
  } else {
    frame.innerHTML = `<p class="video-placeholder">Video in arrivo per questa ricetta</p>`;
    caption.textContent = "";
  }
}

function renderDetail(recipe) {
  $("#detail-emoji").textContent = recipe.emoji || "🍽️";
  $("#detail-category").textContent = CATEGORIES[recipe.category] || recipe.category;
  $("#detail-title").textContent = recipe.title;
  $("#detail-description").textContent = recipe.description || "";

  $("#detail-meta").innerHTML = `
    <span>⏱ Totale: ${formatTime(totalMinutes(recipe))}</span>
    <span>🔪 Prep: ${formatTime(recipe.prepMinutes)}</span>
    <span>🔥 Cottura: ${formatTime(recipe.cookMinutes)}</span>
    <span>👥 ${recipe.servings} porzioni</span>
    <span>📊 ${DIFFICULTY_LABEL[recipe.difficulty] || recipe.difficulty}</span>
  `;

  $("#detail-tags").innerHTML = (recipe.tags || [])
    .map((t) => `<span>#${escapeHtml(t)}</span>`)
    .join("");

  $("#detail-ingredients").innerHTML = (recipe.ingredients || [])
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("");

  $("#detail-steps").innerHTML = (recipe.steps || [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");
}

function openRecipe(index) {
  const recipe = recipes[index];
  if (!recipe) return;

  userPaused = true;
  renderVideo(recipe);
  renderDetail(recipe);

  $("#recipe-stage").classList.remove("hidden");
  $("#donburi").closest(".donburi-wrap").classList.add("hidden");
  $(".bowl-controls").classList.add("hidden");
  $("#bowl-dots").classList.add("hidden");

  document.getElementById("recipe-stage").scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeRecipe() {
  $("#recipe-stage").classList.add("hidden");
  $("#donburi").closest(".donburi-wrap").classList.remove("hidden");
  $(".bowl-controls").classList.remove("hidden");
  $("#bowl-dots").classList.remove("hidden");

  const frame = $("#video-frame");
  frame.innerHTML = `<p class="video-placeholder">Seleziona una ricetta dalla bowl</p>`;
  $("#video-caption").textContent = "";

  userPaused = false;
}

async function loadRecipes() {
  try {
    const res = await fetch("data/recipes.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    recipes = data.recipes || [];
    activeIndex = 0;
    renderOrbit();
    startAutoSpin();
  } catch (err) {
    console.error("Impossibile caricare le ricette:", err);
    $("#orbit").innerHTML =
      `<p style="color:#b8a898;text-align:center;padding:2rem">Errore nel caricamento delle ricette.</p>`;
  }
}

function init() {
  $("#year").textContent = new Date().getFullYear();

  $("#btn-prev").addEventListener("click", () => {
    userPaused = true;
    prevRecipe();
  });

  $("#btn-next").addEventListener("click", () => {
    userPaused = true;
    nextRecipe();
  });

  $("#btn-back").addEventListener("click", closeRecipe);

  $("#donburi").addEventListener("mouseenter", () => {
    userPaused = true;
  });

  $("#donburi").addEventListener("mouseleave", () => {
    if ($("#recipe-stage").classList.contains("hidden")) userPaused = false;
  });

  document.addEventListener("keydown", (e) => {
    if (!$("#recipe-stage").classList.contains("hidden")) {
      if (e.key === "Escape") closeRecipe();
      return;
    }
    if (e.key === "ArrowLeft") {
      userPaused = true;
      prevRecipe();
    }
    if (e.key === "ArrowRight") {
      userPaused = true;
      nextRecipe();
    }
    if (e.key === "Enter") openRecipe(activeIndex);
  });

  loadRecipes();
}

init();
