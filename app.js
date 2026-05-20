const {
  BACKEND_MODE_CLOUD,
  buildWhatsAppUrl,
  escapeHtml,
  getBackendMode,
  getPublicProducts,
  loginAdmin,
  normalize
} = window.RosmeriStore;

const heroTrack = document.getElementById("heroTrack");
const carouselDots = document.getElementById("carouselDots");
const prevSlideButton = document.getElementById("prevSlide");
const nextSlideButton = document.getElementById("nextSlide");
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const searchFeedback = document.getElementById("searchFeedback");
const productsGrid = document.getElementById("productsGrid");
const openAdminAccessButton = document.getElementById("openAdminAccess");
const closeAdminAccessButton = document.getElementById("closeAdminAccess");
const adminModal = document.getElementById("adminModal");
const adminAccessForm = document.getElementById("adminAccessForm");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const adminModalStatus = document.getElementById("adminModalStatus");

let products = [];
let currentSlide = 0;
let heroIntervalId = null;

bindEvents();
initStorefront();

function bindEvents() {
  searchForm.addEventListener("submit", handleSearch);
  prevSlideButton.addEventListener("click", () => moveSlide(-1));
  nextSlideButton.addEventListener("click", () => moveSlide(1));
  openAdminAccessButton.addEventListener("click", openAdminModal);
  closeAdminAccessButton.addEventListener("click", closeAdminModal);
  adminAccessForm.addEventListener("submit", handleAdminAccess);
  adminModal.addEventListener("click", (event) => {
    if (event.target === adminModal) {
      closeAdminModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !adminModal.classList.contains("hidden")) {
      closeAdminModal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopHeroAutoplay();
      return;
    }

    startHeroAutoplay();
  });
}

async function initStorefront() {
  searchFeedback.textContent = "Cargando catalogo...";

  try {
    products = await getPublicProducts();
    renderAll();
    startHeroAutoplay();

    const backendMode = await getBackendMode();
    searchFeedback.textContent =
      backendMode === BACKEND_MODE_CLOUD
        ? "Catalogo conectado a base compartida. Los productos pueden verse desde otras computadoras."
        : "Modo local activo. Cuando publiques con Vercel + Supabase, el catalogo se compartira entre computadoras.";
    searchFeedback.className = "search-feedback";
  } catch (error) {
    products = [];
    renderAll();
    searchFeedback.textContent =
      error.message || "No se pudieron cargar los productos en este momento.";
    searchFeedback.className = "search-feedback is-alert";
  }
}

function renderAll(searchTerm = "") {
  renderHero();
  renderProducts(searchTerm);
}

function getHeroSlides() {
  const featuredSlides = products.filter(
    (product) => !product.hidden && (product.featured || product.discount)
  );

  if (featuredSlides.length) {
    return featuredSlides.slice(0, 4);
  }

  return products.filter((product) => !product.hidden).slice(0, 4);
}

function renderHero() {
  const slides = getHeroSlides();

  if (!slides.length) {
    heroTrack.innerHTML = `
      <div class="empty-state">
        Todavia no hay productos publicados. En cuanto cargues el primero desde el admin, va a aparecer aca.
      </div>
    `;
    carouselDots.innerHTML = "";
    return;
  }

  if (currentSlide >= slides.length) {
    currentSlide = 0;
  }

  heroTrack.innerHTML = slides
    .map((product, index) => {
      const safeName = escapeHtml(product.name);
      const safeDescription = escapeHtml(product.description);
      const safeImage = escapeHtml(product.image);

      return `
        <article class="hero-slide ${index === currentSlide ? "is-active" : ""}">
          <div class="hero-slide-media">
            <img src="${safeImage}" alt="${safeName}" />
          </div>
          <div class="hero-slide-caption">
            <div class="slide-tags">
              <span class="tag">${product.stock} en stock</span>
              ${product.discount ? '<span class="tag discount">En descuento</span>' : '<span class="tag">Disponible</span>'}
            </div>
            <h3>${safeName}</h3>
            <p>${safeDescription}</p>
          </div>
        </article>
      `;
    })
    .join("");

  carouselDots.innerHTML = slides
    .map(
      (_, index) =>
        `<button class="${index === currentSlide ? "is-active" : ""}" type="button" aria-label="Ir a promocion ${index + 1}" data-index="${index}"></button>`
    )
    .join("");

  carouselDots.querySelectorAll("button").forEach((dotButton) => {
    dotButton.addEventListener("click", () => {
      currentSlide = Number(dotButton.dataset.index);
      renderHero();
      restartHeroAutoplay();
    });
  });
}

function moveSlide(direction) {
  const slides = getHeroSlides();

  if (!slides.length) {
    return;
  }

  currentSlide = (currentSlide + direction + slides.length) % slides.length;
  renderHero();
  restartHeroAutoplay();
}

function startHeroAutoplay() {
  if (!products.length) {
    return;
  }

  stopHeroAutoplay();
  heroIntervalId = window.setInterval(() => moveSlide(1), 5000);
}

function stopHeroAutoplay() {
  if (heroIntervalId) {
    window.clearInterval(heroIntervalId);
  }
}

function restartHeroAutoplay() {
  stopHeroAutoplay();
  startHeroAutoplay();
}

function renderProducts(searchTerm = "") {
  const normalizedSearch = normalize(searchTerm);
  const visibleProducts = products.filter((product) => !product.hidden);
  const filteredProducts = normalizedSearch
    ? visibleProducts.filter((product) =>
        [product.name, product.description, product.price]
          .map((field) => normalize(field))
          .some((field) => field.includes(normalizedSearch))
      )
    : visibleProducts;

  if (!filteredProducts.length) {
    productsGrid.innerHTML = `
      <div class="empty-state">
        No encontramos productos con esa busqueda. Proba con otro nombre o revisa el catalogo completo.
      </div>
    `;
    return;
  }

  productsGrid.innerHTML = filteredProducts
    .map((product) => {
      const safeName = escapeHtml(product.name);
      const safeDescription = escapeHtml(product.description);
      const safeImage = escapeHtml(product.image);
      const safePrice = escapeHtml(product.price);

      return `
        <article class="product-card">
          <div class="product-media">
            <img src="${safeImage}" alt="${safeName}" />
            <div class="product-badges">
              <span class="badge">${product.stock} en stock</span>
              ${product.discount ? '<span class="badge discount">Descuento</span>' : ""}
            </div>
          </div>
          <div class="product-body">
            <h3>${safeName}</h3>
            <div class="product-meta">
              <span>${safePrice}</span>
              <span>${product.discount ? "Con descuento" : "Disponible"}</span>
            </div>
            <p class="product-description">${safeDescription}</p>
            <div class="product-footer">
              <span class="product-price">${safePrice}</span>
              <a
                class="product-action"
                href="${buildWhatsAppUrl(product.name)}"
                target="_blank"
                rel="noreferrer"
              >
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function handleSearch(event) {
  event.preventDefault();
  const rawValue = searchInput.value.trim();

  renderProducts(rawValue);

  if (!rawValue) {
    getBackendMode().then((backendMode) => {
      searchFeedback.textContent =
        backendMode === BACKEND_MODE_CLOUD
          ? "Catalogo conectado a base compartida. Los productos pueden verse desde otras computadoras."
          : "Modo local activo. Cuando publiques con Vercel + Supabase, el catalogo se compartira entre computadoras.";
      searchFeedback.className = "search-feedback";
    });
    return;
  }

  searchFeedback.textContent = `Mostrando resultados para "${rawValue}".`;
  searchFeedback.className = "search-feedback";
}

async function handleAdminAccess(event) {
  event.preventDefault();
  const rawPassword = adminPasswordInput.value.trim();

  if (!rawPassword) {
    setAdminModalStatus("Ingresa tu clave privada para continuar.", "error");
    return;
  }

  const accessResult = await loginAdmin(rawPassword);

  if (accessResult.ok) {
    adminPasswordInput.value = "";
    window.location.href = "admin.html";
    return;
  }

  if (accessResult.reason === "locked") {
    setAdminModalStatus(
      `Acceso interno bloqueado temporalmente. Intenta otra vez en ${formatRemainingTime(
        accessResult.remainingMs
      )}.`,
      "error"
    );
    return;
  }

  setAdminModalStatus(
    accessResult.message || "Clave interna no valida. Volve a intentarlo.",
    "error"
  );
}

function formatRemainingTime(remainingMs) {
  const totalMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return totalMinutes === 1 ? "1 minuto" : `${totalMinutes} minutos`;
}

function openAdminModal() {
  adminModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  setAdminModalStatus(
    "La sesion interna dura 20 minutos y no deja la clave visible al escribirla.",
    ""
  );
  window.setTimeout(() => adminPasswordInput.focus(), 50);
}

function closeAdminModal() {
  adminModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  adminAccessForm.reset();
  setAdminModalStatus(
    "La sesion interna dura 20 minutos y no deja la clave visible al escribirla.",
    ""
  );
}

function setAdminModalStatus(message, tone) {
  adminModalStatus.textContent = message;
  adminModalStatus.className = "status-banner";

  if (tone) {
    adminModalStatus.classList.add(`is-${tone}`);
  }
}
