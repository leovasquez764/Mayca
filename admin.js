const {
  BACKEND_MODE_CLOUD,
  clearAdminAccess,
  escapeHtml,
  formatAmount,
  formatPrice,
  formatSaleDate,
  getAdminProducts,
  getBackendMode,
  getSales,
  hasAdminAccess,
  priceTextToNumber,
  readImageFile,
  recordSale,
  setProductVisibility,
  upsertProduct,
  validateImageFile
} = window.RosmeriStore;

const adminForm = document.getElementById("adminForm");
const adminList = document.getElementById("adminList");
const saveProductButton = document.getElementById("saveProductButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const statusBanner = document.getElementById("statusBanner");
const productImageFile = document.getElementById("productImageFile");
const imagePreviewWrap = document.getElementById("imagePreviewWrap");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewText = document.getElementById("imagePreviewText");
const saleForm = document.getElementById("saleForm");
const saleProductId = document.getElementById("saleProductId");
const saleQuantity = document.getElementById("saleQuantity");
const saleCustomerName = document.getElementById("saleCustomerName");
const saleCustomerContact = document.getElementById("saleCustomerContact");
const saleNotes = document.getElementById("saleNotes");
const salePreview = document.getElementById("salePreview");
const salesList = document.getElementById("salesList");

let products = [];
let sales = [];
let editingProductId = null;
let editingImageValue = "";
let selectedImageData = "";
let backendMode = "";

bindEvents();
initAdmin();

function bindEvents() {
  adminForm.addEventListener("submit", handleAdminSubmit);
  cancelEditButton.addEventListener("click", resetAdminForm);
  productImageFile.addEventListener("change", handleImageSelection);
  saleForm.addEventListener("submit", handleSaleSubmit);
  saleProductId.addEventListener("change", updateSalePreview);
  saleQuantity.addEventListener("input", updateSalePreview);
}

async function initAdmin() {
  if (!(await hasAdminAccess())) {
    window.location.replace("index.html");
    return;
  }

  setStatus("Cargando panel admin...", "");

  try {
    backendMode = await getBackendMode();
    await refreshAdminData();
    renderImagePreview("");

    if (backendMode === BACKEND_MODE_CLOUD) {
      setStatus(
        "Base compartida activa. Productos y ventas se sincronizan para otras computadoras.",
        "success"
      );
    } else {
      setStatus(
        "Modo local de respaldo. Cuando publiques con Vercel + Supabase, esta informacion quedara compartida.",
        ""
      );
    }
  } catch (error) {
    setStatus(error.message || "No se pudo cargar el panel admin.", "error");
  }
}

async function refreshAdminData() {
  products = await getAdminProducts();
  sales = await getSales();
  renderAdminList();
  renderSaleOptions();
  renderSalesList();
  updateSalePreview();
}

async function handleImageSelection() {
  if (!(await hasAdminAccess())) {
    window.location.replace("index.html");
    return;
  }

  const file = productImageFile.files[0];

  if (!file) {
    selectedImageData = "";
    renderImagePreview(editingImageValue);
    return;
  }

  const validation = validateImageFile(file);

  if (!validation.valid) {
    productImageFile.value = "";
    selectedImageData = "";
    renderImagePreview(editingImageValue);
    setStatus(validation.message, "error");
    return;
  }

  try {
    selectedImageData = await readImageFile(file);
    renderImagePreview(selectedImageData, file.name);
    setStatus("Imagen lista para guardar.", "success");
  } catch (error) {
    productImageFile.value = "";
    selectedImageData = "";
    renderImagePreview(editingImageValue);
    setStatus(error.message, "error");
  }
}

async function handleAdminSubmit(event) {
  event.preventDefault();

  if (!(await hasAdminAccess())) {
    window.location.replace("index.html");
    return;
  }

  const wasEditing = Boolean(editingProductId);
  const file = productImageFile.files[0];

  if (file && !selectedImageData) {
    const validation = validateImageFile(file);
    setStatus(validation.valid ? "No se pudo preparar la imagen." : validation.message, "error");
    return;
  }

  if (!wasEditing && !selectedImageData) {
    setStatus("Para agregar un producto nuevo, subi una imagen PNG o JPG.", "error");
    return;
  }

  const imageValue = selectedImageData || editingImageValue;
  const product = {
    id: editingProductId || window.RosmeriStore.createId(),
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price: document.getElementById("productPrice").value.trim(),
    stock: Number(document.getElementById("productStock").value),
    image: imageValue,
    discount: document.getElementById("productDiscount").checked,
    hidden: false,
    featured: false
  };

  try {
    await upsertProduct(product, wasEditing ? "update" : "create");
    await refreshAdminData();
    resetAdminForm();
    setStatus(
      wasEditing ? "Producto actualizado correctamente." : "Producto agregado correctamente.",
      "success"
    );
  } catch (error) {
    setStatus(error.message || "No se pudo guardar el producto.", "error");
  }
}

async function handleSaleSubmit(event) {
  event.preventDefault();

  if (!(await hasAdminAccess())) {
    window.location.replace("index.html");
    return;
  }

  const payload = {
    productId: saleProductId.value,
    quantity: Number(saleQuantity.value),
    customerName: saleCustomerName.value.trim(),
    customerContact: saleCustomerContact.value.trim(),
    notes: saleNotes.value.trim()
  };

  if (!payload.productId) {
    setStatus("Elegi un producto antes de guardar la venta.", "error");
    return;
  }

  try {
    await recordSale(payload);
    await refreshAdminData();
    saleForm.reset();
    saleQuantity.value = "1";
    updateSalePreview();
    setStatus("Venta guardada correctamente.", "success");
  } catch (error) {
    setStatus(error.message || "No se pudo guardar la venta.", "error");
  }
}

function renderAdminList() {
  if (!products.length) {
    adminList.innerHTML = `
      <div class="empty-state compact">
        Todavia no hay productos en la base. Agrega el primero desde el formulario.
      </div>
    `;
    return;
  }

  adminList.innerHTML = products
    .map((product) => {
      const safeName = escapeHtml(product.name);
      const safeDescription = escapeHtml(product.description);
      const safeImage = escapeHtml(product.image);
      const safePrice = escapeHtml(product.price);

      return `
        <article class="admin-card ${product.hidden ? "is-hidden" : ""}">
          <div class="admin-card-top">
            <img class="admin-thumb" src="${safeImage}" alt="${safeName}" />
            <div class="admin-card-copy">
              <div class="admin-meta">
                <span>${safeName}</span>
                <span>${product.stock} en stock</span>
                <span>${safePrice}</span>
                <span>${product.discount ? "Con descuento" : "Sin descuento"}</span>
                <span>${product.hidden ? "Oculto" : "Visible"}</span>
              </div>
              <p>${safeDescription}</p>
            </div>
          </div>
          <div class="admin-actions">
            <button class="admin-action-button edit" type="button" data-edit-id="${product.id}">
              Modificar producto
            </button>
            <button class="admin-action-button toggle" type="button" data-toggle-id="${product.id}">
              ${product.hidden ? "Mostrar producto" : "Ocultar producto"}
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  adminList.querySelectorAll("[data-edit-id]").forEach((button) => {
    button.addEventListener("click", () => startEditing(button.dataset.editId));
  });

  adminList.querySelectorAll("[data-toggle-id]").forEach((button) => {
    button.addEventListener("click", () => toggleVisibility(button.dataset.toggleId));
  });
}

function renderSaleOptions() {
  if (!products.length) {
    saleProductId.innerHTML = `<option value="">No hay productos disponibles</option>`;
    return;
  }

  const currentValue = saleProductId.value;
  const saleProducts = products.filter((product) => product.stock > 0);

  saleProductId.innerHTML = `
    <option value="">Seleccionar producto</option>
    ${saleProducts
      .map(
        (product) =>
          `<option value="${product.id}">${escapeHtml(product.name)} - ${escapeHtml(
            product.price
          )} - stock ${product.stock}</option>`
      )
      .join("")}
  `;

  if (saleProducts.some((product) => product.id === currentValue)) {
    saleProductId.value = currentValue;
  }
}

function renderSalesList() {
  if (!sales.length) {
    salesList.innerHTML = `
      <div class="empty-state compact">
        Aun no registraste ventas. Cuando guardes la primera, va a aparecer aca.
      </div>
    `;
    return;
  }

  salesList.innerHTML = sales
    .map((sale) => {
      const safeName = escapeHtml(sale.productName);
      const safeCustomerName = escapeHtml(sale.customerName || "Cliente sin nombre");
      const safeCustomerContact = escapeHtml(sale.customerContact || "Sin contacto");
      const safeNotes = sale.notes ? `<p>${escapeHtml(sale.notes)}</p>` : "";

      return `
        <article class="sale-row">
          <div class="sale-topline">
            <strong>${safeName}</strong>
            <span>${escapeHtml(sale.totalPrice)}</span>
          </div>
          <div class="sale-meta">
            <span>${sale.quantity} unidad${sale.quantity === 1 ? "" : "es"}</span>
            <span>${escapeHtml(sale.unitPrice)}</span>
            <span>${safeCustomerName}</span>
            <span>${safeCustomerContact}</span>
            <span>${formatSaleDate(sale.createdAt)}</span>
          </div>
          ${safeNotes}
        </article>
      `;
    })
    .join("");
}

function updateSalePreview() {
  const product = products.find((item) => item.id === saleProductId.value);
  const quantity = Math.max(1, Number(saleQuantity.value) || 1);

  if (!product) {
    salePreview.textContent = "Elegi un producto para ver el total estimado.";
    return;
  }

  const total = formatPrice(product.price, quantity);
  const stockAfterSale = Math.max(product.stock - quantity, 0);
  const unitAmount = priceTextToNumber(product.price);
  const helper =
    unitAmount > 0
      ? `Precio unitario: ${product.price}. Total estimado: ${total}. Stock despues de vender: ${stockAfterSale}.`
      : `Total estimado: ${total}. Stock despues de vender: ${stockAfterSale}.`;

  salePreview.textContent = helper;
}

function startEditing(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  editingProductId = product.id;
  editingImageValue = product.image;
  selectedImageData = "";
  adminForm.reset();
  document.getElementById("productId").value = product.id;
  document.getElementById("productName").value = product.name;
  document.getElementById("productDescription").value = product.description;
  document.getElementById("productPrice").value = product.price;
  document.getElementById("productStock").value = product.stock;
  document.getElementById("productDiscount").checked = product.discount;
  saveProductButton.textContent = "Guardar cambios";
  cancelEditButton.classList.remove("hidden");
  renderImagePreview(editingImageValue, "Imagen actual");
  setStatus("Podes cambiar los datos y subir otra imagen si queres.", "success");
  adminForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetAdminForm() {
  editingProductId = null;
  editingImageValue = "";
  selectedImageData = "";
  adminForm.reset();
  productImageFile.value = "";
  saveProductButton.textContent = "Agregar producto";
  cancelEditButton.classList.add("hidden");
  renderImagePreview("");
}

async function toggleVisibility(productId) {
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return;
  }

  try {
    await setProductVisibility(productId, !product.hidden);
    await refreshAdminData();
    setStatus("Estado del producto actualizado.", "success");
  } catch (error) {
    setStatus(error.message || "No se pudo cambiar la visibilidad.", "error");
  }
}

function renderImagePreview(imageData, label = "Vista previa") {
  if (!imageData) {
    imagePreviewWrap.classList.add("hidden");
    imagePreview.removeAttribute("src");
    imagePreviewText.textContent = "";
    return;
  }

  imagePreviewWrap.classList.remove("hidden");
  imagePreview.src = imageData;
  imagePreviewText.textContent = label;
}

function setStatus(message, tone = "") {
  statusBanner.textContent = message;
  statusBanner.className = "status-banner";

  if (tone) {
    statusBanner.classList.add(`is-${tone}`);
  }
}
