let photos = [];
let currentIndex = 0;
let viewMode = "grid";

async function loadConfig() {
  try {
    const res = await fetch("config.json");
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg.siteTitle) {
      document.getElementById("site-title").textContent = cfg.siteTitle;
      document.title = cfg.siteTitle;
    }
    if (cfg.tagline) document.getElementById("site-tagline").textContent = cfg.tagline;
    if (cfg.photographer) {
      const title = cfg.siteTitle || "Noi";
      document.getElementById("footer-text").innerHTML =
        `&copy; <span id="year"></span> ${cfg.photographer} — ${title}`;
      document.getElementById("year").textContent = new Date().getFullYear();
    }
    const sizesEl = document.getElementById("print-sizes");
    if (sizesEl && cfg.printSizes) {
      sizesEl.innerHTML = cfg.printSizes
        .map((s) => `<li><strong>${s.name}</strong> — ${s.dpi} DPI consigliati</li>`)
        .join("");
    }
  } catch (_) {}
}

async function loadGallery() {
  try {
    const res = await fetch("data/gallery.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    photos = data.photos || [];
    document.getElementById("photo-count").textContent =
      photos.length ? `${photos.length} fotografie in vetrina` : "";
    renderGallery();
  } catch (err) {
    console.error("Impossibile caricare la gallery:", err);
    document.getElementById("empty-state").classList.remove("hidden");
    document.querySelector("#empty-state p").textContent =
      "Errore nel caricamento delle foto. Ricarica la pagina.";
  }
}

function renderGallery() {
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("empty-state");

  if (!photos.length) {
    gallery.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  gallery.className = "gallery" + (viewMode === "featured" ? " featured-mode" : "");

  gallery.innerHTML = photos
    .map(
      (p, i) => `
    <button type="button" class="gallery-item" data-index="${i}" aria-label="${p.title}">
      <img src="${p.thumb}" alt="${p.title}" loading="lazy">
      <div class="item-overlay"><span class="item-title">${p.title}</span></div>
    </button>`
    )
    .join("");

  gallery.querySelectorAll(".gallery-item").forEach((btn) => {
    btn.addEventListener("click", () => openLightbox(+btn.dataset.index));
  });
}

function openLightbox(index) {
  currentIndex = index;
  const p = photos[index];
  const lb = document.getElementById("lightbox");
  document.getElementById("lb-img").src = p.web;
  document.getElementById("lb-title").textContent = p.title;
  document.getElementById("lb-meta").textContent =
    `${p.width} × ${p.height} px · ${p.orientation === "landscape" ? "Orizzontale" : "Verticale"}`;
  document.getElementById("lb-download").href = p.original;
  document.getElementById("lb-download").download = p.original.split("/").pop();
  lb.classList.remove("hidden");
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  lb.classList.add("hidden");
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function navLightbox(delta) {
  currentIndex = (currentIndex + delta + photos.length) % photos.length;
  openLightbox(currentIndex);
}

document.getElementById("lb-close").addEventListener("click", closeLightbox);
document.getElementById("lb-prev").addEventListener("click", () => navLightbox(-1));
document.getElementById("lb-next").addEventListener("click", () => navLightbox(1));
document.getElementById("lb-print").addEventListener("click", () => window.print());

document.getElementById("lightbox").addEventListener("click", (e) => {
  if (e.target.id === "lightbox") closeLightbox();
});

let touchStartX = 0;
const lightboxEl = document.getElementById("lightbox");
lightboxEl.addEventListener("touchstart", (e) => {
  touchStartX = e.changedTouches[0].screenX;
}, { passive: true });
lightboxEl.addEventListener("touchend", (e) => {
  if (lightboxEl.classList.contains("hidden")) return;
  const delta = e.changedTouches[0].screenX - touchStartX;
  if (Math.abs(delta) < 50) return;
  navLightbox(delta > 0 ? -1 : 1);
}, { passive: true });

document.addEventListener("keydown", (e) => {
  const lb = document.getElementById("lightbox");
  if (lb.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") navLightbox(-1);
  if (e.key === "ArrowRight") navLightbox(1);
});

document.getElementById("btn-grid").addEventListener("click", () => {
  viewMode = "grid";
  document.getElementById("btn-grid").classList.add("active");
  document.getElementById("btn-featured").classList.remove("active");
  renderGallery();
});

document.getElementById("btn-featured").addEventListener("click", () => {
  viewMode = "featured";
  document.getElementById("btn-featured").classList.add("active");
  document.getElementById("btn-grid").classList.remove("active");
  renderGallery();
});

document.getElementById("btn-print-info").addEventListener("click", () => {
  document.getElementById("print-info").classList.toggle("hidden");
});

document.getElementById("year").textContent = new Date().getFullYear();

loadConfig();
loadGallery();
