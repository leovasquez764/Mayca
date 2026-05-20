const RosmeriStore = (() => {
  const WHATSAPP_NUMBER = "5491150522096";
  const ADMIN_CODE_HASH = "f9135e272b0cdc382b63971604bfec43f609a8fcc4165196ce23b136e34cb2ba";
  const LOCAL_PRODUCTS_KEY = "tiendas-rosmeri-products";
  const LOCAL_SALES_KEY = "tiendas-rosmeri-sales";
  const LOCAL_ADMIN_STORAGE_KEY = "tiendas-rosmeri-admin-session";
  const LOCAL_ADMIN_ATTEMPTS_STORAGE_KEY = "tiendas-rosmeri-admin-attempts";
  const CLOUD_ADMIN_TOKEN_KEY = "tiendas-rosmeri-cloud-admin-token";
  const ADMIN_ACCESS_TTL_MS = 20 * 60 * 1000;
  const ADMIN_MAX_ATTEMPTS = 4;
  const ADMIN_LOCK_MS = 5 * 60 * 1000;
  const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
  const BACKEND_MODE_LOCAL = "local";
  const BACKEND_MODE_CLOUD = "cloud";

  const productPalettes = [
    { bg: "#ffd9c7", accent: "#ff6b57" },
    { bg: "#d4f4ea", accent: "#1f8a82" },
    { bg: "#ffeaa5", accent: "#d97d00" },
    { bg: "#dfdbff", accent: "#6b5dd3" },
    { bg: "#ffd7ea", accent: "#db4e8c" }
  ];

  const defaultProducts = [
    {
      id: createId(),
      name: "Combo Hogar Premium",
      description: "Set ideal para renovar espacios con piezas versatiles y terminaciones modernas.",
      price: "$ 48.500",
      stock: 8,
      image: createPlaceholderImage("Combo Hogar", "Nuevos ingresos", "#ffd9c7", "#ff6b57"),
      discount: true,
      hidden: false,
      featured: true
    },
    {
      id: createId(),
      name: "Organizador Multiuso",
      description: "Practico, liviano y perfecto para tener todo ordenado en casa o el local.",
      price: "$ 19.900",
      stock: 15,
      image: createPlaceholderImage("Organizador", "Listo para entrega", "#d4f4ea", "#1f8a82"),
      discount: false,
      hidden: false,
      featured: true
    },
    {
      id: createId(),
      name: "Set Deco Rosmeri",
      description: "Piezas decorativas con look calido para regalos o para sumar estilo al ambiente.",
      price: "$ 32.400",
      stock: 6,
      image: createPlaceholderImage("Set Deco", "Edicion especial", "#ffe6c1", "#d97d00"),
      discount: true,
      hidden: false,
      featured: true
    },
    {
      id: createId(),
      name: "Canasta Textil",
      description: "Canasta resistente para guardado diario, con diseno simple y funcional.",
      price: "$ 14.700",
      stock: 12,
      image: createPlaceholderImage("Canasta", "Stock limitado", "#e5dbff", "#6b5dd3"),
      discount: false,
      hidden: false,
      featured: false
    },
    {
      id: createId(),
      name: "Bandeja Aurora",
      description: "Ideal para desayunos, mesas dulces o presentaciones con un toque elegante.",
      price: "$ 21.600",
      stock: 10,
      image: createPlaceholderImage("Bandeja", "Entrega rapida", "#ffd7ea", "#db4e8c"),
      discount: false,
      hidden: false,
      featured: false
    },
    {
      id: createId(),
      name: "Caja Decorativa",
      description: "Solucion linda y practica para regalos, souvenires o almacenamiento.",
      price: "$ 11.200",
      stock: 20,
      image: createPlaceholderImage("Caja Deco", "Consultas abiertas", "#dff6fb", "#1583a8"),
      discount: true,
      hidden: false,
      featured: false
    }
  ];

  let backendModePromise = null;

  function getDefaultProducts() {
    return defaultProducts.map((product) => ({ ...product }));
  }

  function getDefaultSales() {
    return [];
  }

  async function getBackendMode() {
    if (!backendModePromise) {
      backendModePromise = detectBackendMode();
    }

    return backendModePromise;
  }

  async function detectBackendMode() {
    if (typeof window === "undefined" || window.location.protocol === "file:") {
      return BACKEND_MODE_LOCAL;
    }

    try {
      const response = await fetch("/api/products", {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        return BACKEND_MODE_LOCAL;
      }

      const payload = await safeJson(response);
      return Array.isArray(payload.products) ? BACKEND_MODE_CLOUD : BACKEND_MODE_LOCAL;
    } catch (error) {
      return BACKEND_MODE_LOCAL;
    }
  }

  function resetBackendMode() {
    backendModePromise = null;
  }

  async function getPublicProducts() {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await fetch("/api/products", {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw await buildApiError(response, "No se pudieron cargar los productos publicados.");
      }

      const payload = await safeJson(response);
      return Array.isArray(payload.products) ? payload.products : [];
    }

    return loadLocalProducts().filter((product) => !product.hidden);
  }

  async function getAdminProducts() {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await adminFetch("/api/admin-products", {
        method: "GET"
      });

      const payload = await safeJson(response);
      return Array.isArray(payload.products) ? payload.products : [];
    }

    return loadLocalProducts();
  }

  async function getSales() {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await adminFetch("/api/admin-sales", {
        method: "GET"
      });

      const payload = await safeJson(response);
      return Array.isArray(payload.sales) ? payload.sales : [];
    }

    return loadLocalSales();
  }

  async function loginAdmin(code) {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await fetch("/api/admin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          code
        })
      });

      const payload = await safeJson(response);

      if (!response.ok) {
        return {
          ok: false,
          mode,
          reason: payload.errorCode || "invalid",
          message: payload.message || "No se pudo validar la clave.",
          remainingMs: payload.remainingMs || 0
        };
      }

      saveCloudToken(payload.token, payload.expiresAt);
      clearLocalAdminFailures();
      return {
        ok: true,
        mode
      };
    }

    const accessResult = await validateLocalAdminCode(code);

    if (accessResult.ok) {
      grantLocalAdminAccess();
    }

    return {
      ...accessResult,
      mode
    };
  }

  async function hasAdminAccess() {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      return Boolean(readCloudToken());
    }

    return hasLocalAdminAccess();
  }

  function clearAdminAccess() {
    clearCloudToken();
    clearLocalAdminAccess();
  }

  async function upsertProduct(product, action = "create") {
    const mode = await getBackendMode();
    const preparedProduct = sanitizeProduct(product);

    if (mode === BACKEND_MODE_CLOUD) {
      const method = action === "update" ? "PUT" : "POST";
      const response = await adminFetch("/api/admin-products", {
        method,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          product: preparedProduct
        })
      });

      const payload = await safeJson(response);
      return payload.product;
    }

    let products = loadLocalProducts();

    if (action === "update") {
      products = products.map((item) => {
        if (item.id !== preparedProduct.id) {
          return item;
        }

        return {
          ...item,
          ...preparedProduct,
          hidden: item.hidden,
          featured: item.featured
        };
      });
    } else {
      products.unshift(preparedProduct);
    }

    saveLocalProducts(products);
    return preparedProduct;
  }

  async function setProductVisibility(productId, hidden) {
    const mode = await getBackendMode();

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await adminFetch("/api/admin-products", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId,
          hidden
        })
      });

      const payload = await safeJson(response);
      return payload.product;
    }

    const products = loadLocalProducts().map((product) =>
      product.id === productId ? { ...product, hidden } : product
    );

    saveLocalProducts(products);
    return products.find((product) => product.id === productId) || null;
  }

  async function recordSale(saleInput) {
    const mode = await getBackendMode();
    const preparedSale = sanitizeSaleInput(saleInput);

    if (mode === BACKEND_MODE_CLOUD) {
      const response = await adminFetch("/api/admin-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(preparedSale)
      });

      const payload = await safeJson(response);
      return {
        sale: payload.sale,
        product: payload.product
      };
    }

    const products = loadLocalProducts();
    const product = products.find((item) => item.id === preparedSale.productId);

    if (!product) {
      throw new Error("No encontramos el producto seleccionado.");
    }

    if (preparedSale.quantity > product.stock) {
      throw new Error("La cantidad vendida supera el stock disponible.");
    }

    const updatedProduct = {
      ...product,
      stock: product.stock - preparedSale.quantity
    };

    const updatedProducts = products.map((item) =>
      item.id === updatedProduct.id ? updatedProduct : item
    );

    const sale = {
      id: createId("sale"),
      productId: product.id,
      productName: product.name,
      quantity: preparedSale.quantity,
      unitPrice: product.price,
      totalPrice: formatPrice(product.price, preparedSale.quantity),
      customerName: preparedSale.customerName,
      customerContact: preparedSale.customerContact,
      notes: preparedSale.notes,
      createdAt: new Date().toISOString()
    };

    const sales = [sale, ...loadLocalSales()];
    saveLocalProducts(updatedProducts);
    saveLocalSales(sales);

    return {
      sale,
      product: updatedProduct
    };
  }

  function loadLocalProducts() {
    const storedProducts = localStorage.getItem(LOCAL_PRODUCTS_KEY);

    if (!storedProducts) {
      const initialProducts = getDefaultProducts();
      saveLocalProducts(initialProducts);
      return initialProducts;
    }

    try {
      const parsed = JSON.parse(storedProducts);
      return Array.isArray(parsed) && parsed.length ? parsed : getDefaultProducts();
    } catch (error) {
      const fallbackProducts = getDefaultProducts();
      saveLocalProducts(fallbackProducts);
      return fallbackProducts;
    }
  }

  function saveLocalProducts(products) {
    localStorage.setItem(LOCAL_PRODUCTS_KEY, JSON.stringify(products));
  }

  function loadLocalSales() {
    const storedSales = localStorage.getItem(LOCAL_SALES_KEY);

    if (!storedSales) {
      const initialSales = getDefaultSales();
      saveLocalSales(initialSales);
      return initialSales;
    }

    try {
      const parsed = JSON.parse(storedSales);
      return Array.isArray(parsed) ? parsed : getDefaultSales();
    } catch (error) {
      const fallbackSales = getDefaultSales();
      saveLocalSales(fallbackSales);
      return fallbackSales;
    }
  }

  function saveLocalSales(sales) {
    localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(sales));
  }

  function grantLocalAdminAccess() {
    localStorage.setItem(
      LOCAL_ADMIN_STORAGE_KEY,
      JSON.stringify({
        grantedAt: Date.now()
      })
    );
    clearLocalAdminFailures();
  }

  function hasLocalAdminAccess() {
    try {
      const rawSession = localStorage.getItem(LOCAL_ADMIN_STORAGE_KEY);

      if (!rawSession) {
        return false;
      }

      const session = JSON.parse(rawSession);

      if (!session.grantedAt || Date.now() - session.grantedAt > ADMIN_ACCESS_TTL_MS) {
        clearLocalAdminAccess();
        return false;
      }

      return true;
    } catch (error) {
      clearLocalAdminAccess();
      return false;
    }
  }

  function clearLocalAdminAccess() {
    localStorage.removeItem(LOCAL_ADMIN_STORAGE_KEY);
  }

  async function validateLocalAdminCode(candidate) {
    const currentAttempts = getLocalAdminAttempts();

    if (currentAttempts.lockedUntil && currentAttempts.lockedUntil > Date.now()) {
      return {
        ok: false,
        reason: "locked",
        remainingMs: currentAttempts.lockedUntil - Date.now(),
        message: "Acceso temporalmente bloqueado."
      };
    }

    const hashedCandidate = await hashText(candidate);

    if (hashedCandidate === ADMIN_CODE_HASH) {
      clearLocalAdminFailures();
      return {
        ok: true,
        reason: "granted",
        remainingMs: 0,
        message: ""
      };
    }

    const updatedAttempts = registerLocalFailedAttempt();
    return {
      ok: false,
      reason: updatedAttempts.lockedUntil > Date.now() ? "locked" : "invalid",
      remainingMs: Math.max(updatedAttempts.lockedUntil - Date.now(), 0),
      message: "Clave no valida."
    };
  }

  function getLocalAdminAttempts() {
    try {
      const rawAttempts = localStorage.getItem(LOCAL_ADMIN_ATTEMPTS_STORAGE_KEY);

      if (!rawAttempts) {
        return { count: 0, lockedUntil: 0 };
      }

      const attempts = JSON.parse(rawAttempts);
      const count = Number(attempts.count) || 0;
      const lockedUntil = Number(attempts.lockedUntil) || 0;

      if (lockedUntil && lockedUntil <= Date.now()) {
        clearLocalAdminFailures();
        return { count: 0, lockedUntil: 0 };
      }

      return { count, lockedUntil };
    } catch (error) {
      clearLocalAdminFailures();
      return { count: 0, lockedUntil: 0 };
    }
  }

  function registerLocalFailedAttempt() {
    const attempts = getLocalAdminAttempts();
    const nextCount = attempts.count + 1;
    const nextLockedUntil = nextCount >= ADMIN_MAX_ATTEMPTS ? Date.now() + ADMIN_LOCK_MS : 0;
    const nextState = {
      count: nextLockedUntil ? ADMIN_MAX_ATTEMPTS : nextCount,
      lockedUntil: nextLockedUntil
    };

    localStorage.setItem(LOCAL_ADMIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(nextState));
    return nextState;
  }

  function clearLocalAdminFailures() {
    localStorage.removeItem(LOCAL_ADMIN_ATTEMPTS_STORAGE_KEY);
  }

  function saveCloudToken(token, expiresAt) {
    localStorage.setItem(
      CLOUD_ADMIN_TOKEN_KEY,
      JSON.stringify({
        token,
        expiresAt
      })
    );
  }

  function readCloudToken() {
    try {
      const rawToken = localStorage.getItem(CLOUD_ADMIN_TOKEN_KEY);

      if (!rawToken) {
        return "";
      }

      const record = JSON.parse(rawToken);

      if (!record.token || !record.expiresAt || Date.now() >= Number(record.expiresAt)) {
        clearCloudToken();
        return "";
      }

      return record.token;
    } catch (error) {
      clearCloudToken();
      return "";
    }
  }

  function clearCloudToken() {
    localStorage.removeItem(CLOUD_ADMIN_TOKEN_KEY);
  }

  async function adminFetch(url, options = {}) {
    const token = readCloudToken();

    if (!token) {
      throw new Error("La sesion admin vencio. Volve a entrar desde la tienda.");
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      clearCloudToken();
      throw new Error("La sesion admin vencio. Volve a entrar desde la tienda.");
    }

    if (!response.ok) {
      throw await buildApiError(response, "No se pudo completar la operacion admin.");
    }

    return response;
  }

  async function buildApiError(response, fallbackMessage) {
    const payload = await safeJson(response);
    return new Error(payload.message || fallbackMessage);
  }

  async function safeJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function sanitizeProduct(product) {
    return {
      id: product.id || createId(),
      name: String(product.name || "").trim(),
      description: String(product.description || "").trim(),
      price: String(product.price || "").trim(),
      stock: Math.max(0, Number(product.stock) || 0),
      image: String(product.image || "").trim(),
      discount: Boolean(product.discount),
      hidden: Boolean(product.hidden),
      featured: Boolean(product.featured)
    };
  }

  function sanitizeSaleInput(saleInput) {
    return {
      productId: String(saleInput.productId || "").trim(),
      quantity: Math.max(1, Number(saleInput.quantity) || 1),
      customerName: String(saleInput.customerName || "").trim(),
      customerContact: String(saleInput.customerContact || "").trim(),
      notes: String(saleInput.notes || "").trim()
    };
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function createId(prefix = "product") {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function pickPalette(seedText) {
    const index = normalize(seedText)
      .split("")
      .reduce((total, character) => total + character.charCodeAt(0), 0) % productPalettes.length;

    return productPalettes[index];
  }

  function createPlaceholderImage(title, subtitle, background, accent) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 700">
        <defs>
          <linearGradient id="heroBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${background}" />
            <stop offset="100%" stop-color="#ffffff" />
          </linearGradient>
        </defs>
        <rect width="900" height="700" rx="48" fill="url(#heroBg)" />
        <circle cx="720" cy="140" r="110" fill="${accent}" opacity="0.18" />
        <circle cx="180" cy="560" r="160" fill="${accent}" opacity="0.12" />
        <rect x="92" y="100" width="716" height="500" rx="42" fill="#ffffff" opacity="0.86" />
        <rect x="142" y="180" width="270" height="270" rx="38" fill="${accent}" opacity="0.2" />
        <rect x="462" y="205" width="220" height="28" rx="14" fill="${accent}" opacity="0.25" />
        <rect x="462" y="260" width="250" height="62" rx="22" fill="${accent}" opacity="0.92" />
        <rect x="462" y="350" width="196" height="24" rx="12" fill="${accent}" opacity="0.28" />
        <text x="142" y="530" font-family="Trebuchet MS, Segoe UI, sans-serif" font-size="58" font-weight="700" fill="#1d2433">${escapeXml(
          title
        )}</text>
        <text x="142" y="585" font-family="Trebuchet MS, Segoe UI, sans-serif" font-size="28" fill="#576074">${escapeXml(
          subtitle
        )}</text>
      </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function isPlaceholderImage(imageValue) {
    return typeof imageValue === "string" && imageValue.startsWith("data:image/svg+xml");
  }

  function buildWhatsAppUrl(productName) {
    const message = encodeURIComponent(
      `Hola, me interesa el producto "${productName}" de Tiendas-Rosmeri. Me das mas informacion?`
    );

    return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  }

  function validateImageFile(file) {
    if (!file) {
      return { valid: false, message: "Tenes que seleccionar una imagen." };
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !["png", "jpg", "jpeg"].includes(extension)) {
      return { valid: false, message: "La imagen debe ser PNG o JPG." };
    }

    return { valid: true, message: "" };
  }

  function readImageFile(file) {
    return new Promise((resolve, reject) => {
      const validation = validateImageFile(file);

      if (!validation.valid) {
        reject(new Error(validation.message));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));
      reader.readAsDataURL(file);
    });
  }

  function priceTextToNumber(priceText) {
    const digits = String(priceText || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function formatAmount(value) {
    return `$ ${new Intl.NumberFormat("es-AR").format(Math.max(0, Number(value) || 0))}`;
  }

  function formatPrice(priceText, quantity) {
    const baseValue = priceTextToNumber(priceText);

    if (!baseValue) {
      return quantity > 1 ? `${priceText} x ${quantity}` : priceText;
    }

    return formatAmount(baseValue * quantity);
  }

  function formatSaleDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  async function hashText(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest))
      .map((item) => item.toString(16).padStart(2, "0"))
      .join("");
  }

  return {
    BACKEND_MODE_CLOUD,
    BACKEND_MODE_LOCAL,
    WHATSAPP_NUMBER,
    buildWhatsAppUrl,
    clearAdminAccess,
    createId,
    escapeHtml,
    formatAmount,
    formatPrice,
    formatSaleDate,
    getAdminProducts,
    getBackendMode,
    getDefaultProducts,
    getPublicProducts,
    getSales,
    hasAdminAccess,
    isPlaceholderImage,
    loginAdmin,
    normalize,
    priceTextToNumber,
    readImageFile,
    recordSale,
    resetBackendMode,
    setProductVisibility,
    upsertProduct,
    validateImageFile
  };
})();

window.RosmeriStore = RosmeriStore;
