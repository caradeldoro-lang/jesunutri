const SUPABASE_URL = "https://wsnnhczdhiysghstplki.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzbm5oY3pkaGl5c2doc3RwbGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDU3ODYsImV4cCI6MjA5NDg4MTc4Nn0.wDawAny58YsXgNgPaV6oKzQD4QdFdLYO8vomVFVKGAQ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DAY_MS = 24 * 60 * 60 * 1000;
const BULK_COLUMNS = ["nombre", "cantidad", "unidad", "fecha_vencimiento", "lote", "observaciones"];
const UNIT_OPTIONS = ["kg", "g", "lt", "ml", "unidad", "caja", "paquete"];
const MONTHS = [
  { label: "Enero", className: "month-1" },
  { label: "Febrero", className: "month-2" },
  { label: "Marzo", className: "month-3" },
  { label: "Abril", className: "month-4" },
  { label: "Mayo", className: "month-5" },
  { label: "Junio", className: "month-6" },
  { label: "Julio", className: "month-7" },
  { label: "Agosto", className: "month-8" },
  { label: "Septiembre", className: "month-9" },
  { label: "Octubre", className: "month-10" },
  { label: "Noviembre", className: "month-11" },
  { label: "Diciembre", className: "month-12" }
];

const formatIsoDate = (date) => date.toISOString().slice(0, 10);

const addDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
};

const mockInventory = [
  {
    id: 1,
    productoId: 1,
    nombre: "Harina fuerza",
    cantidad: 24,
    unidad: "kg",
    fechaVencimiento: addDays(12),
    fechaRecepcion: addDays(-8),
    lote: "HF-2405",
    observaciones: "Ingreso reciente",
    stockMinimo: 20,
    revisada: false
  },
  {
    id: 2,
    productoId: 2,
    nombre: "Azucar granulada",
    cantidad: 8,
    unidad: "kg",
    fechaVencimiento: addDays(-3),
    fechaRecepcion: addDays(-35),
    lote: "AZ-118",
    observaciones: "Revisar retiro por vencimiento",
    stockMinimo: 12,
    revisada: false
  },
  {
    id: 3,
    productoId: 3,
    nombre: "Leche entera",
    cantidad: 18,
    unidad: "lt",
    fechaVencimiento: addDays(0),
    fechaRecepcion: addDays(-2),
    lote: "LE-091",
    observaciones: "Prioridad de consumo",
    stockMinimo: 10,
    revisada: false
  }
];

const state = {
  query: "",
  inventory: [],
  products: [],
  lowStockProducts: [],
  usingFallback: false
};

const elements = {
  totalItems: document.getElementById("totalItems"),
  soonItems: document.getElementById("soonItems"),
  expiredItems: document.getElementById("expiredItems"),
  lowStockItems: document.getElementById("lowStockItems"),
  alertCount: document.getElementById("alertCount"),
  alertsList: document.getElementById("alertsList"),
  inventoryTable: document.getElementById("inventoryTable"),
  searchInput: document.getElementById("searchInput"),
  toast: document.getElementById("toast"),
  errorBox: document.getElementById("errorBox"),
  inventorySourceText: document.getElementById("inventorySourceText"),
  productSuggestions: document.getElementById("productSuggestions"),
  entryModal: document.getElementById("entryModal"),
  entryForm: document.getElementById("entryForm"),
  entryMonthPreview: document.getElementById("entryMonthPreview"),
  saveEntryBtn: document.getElementById("saveEntryBtn"),
  editModal: document.getElementById("editModal"),
  editForm: document.getElementById("editForm"),
  editProductName: document.getElementById("editProductName"),
  editMonthPreview: document.getElementById("editMonthPreview"),
  saveEditBtn: document.getElementById("saveEditBtn"),
  bulkModal: document.getElementById("bulkModal"),
  bulkTableBody: document.getElementById("bulkTableBody"),
  bulkErrorList: document.getElementById("bulkErrorList"),
  bulkReceiptDate: document.getElementById("bulkReceiptDate"),
  saveBulkBtn: document.getElementById("saveBulkBtn"),
  detailModal: document.getElementById("detailModal"),
  detailModalTitle: document.getElementById("detailModalTitle"),
  detailTableBody: document.getElementById("detailTableBody")
};

function normalize(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getDaysRemaining(isoDate) {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.round((target - getToday()) / DAY_MS);
}

function getStatus(item) {
  const days = getDaysRemaining(item.fechaVencimiento);
  if (days === null) return { key: "sin-fecha", label: "Sin fecha", days };
  if (days < 0) return { key: "vencido", label: "Vencido", days };
  if (days === 0) return { key: "hoy", label: "Vence hoy", days };
  if (days <= 20) return { key: "proximo", label: "Proximo a vencer", days };
  return { key: "vigente", label: "Vigente", days };
}

function formatDisplayDate(isoDate) {
  if (!isoDate) return "Sin fecha";
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

function formatDays(days) {
  if (days === null) return "-";
  if (days < 0) return `${Math.abs(days)} vencido`;
  if (days === 0) return "Hoy";
  return `${days} dias`;
}

function getMonthInfo(isoDate) {
  if (!isoDate) return null;
  const [year, month] = isoDate.split("-");
  const info = MONTHS[Number(month) - 1];
  if (!info) return null;
  return { ...info, year };
}

function renderMonthBadge(isoDate) {
  const info = getMonthInfo(isoDate);
  if (!info) return '<span class="month-badge no-month">Sin fecha</span>';
  return `<span class="month-badge"><span class="month-dot ${info.className}"></span>${info.label} ${info.year}</span>`;
}

function setMonthPreview(element, isoDate) {
  element.innerHTML = isoDate ? renderMonthBadge(isoDate) : "";
}

function escapeHtml(value) {
  return (value ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSupabaseErrorMessage(error) {
  if (!error) return "Error desconocido";
  return [error.message, error.details, error.hint].filter(Boolean).join(" | ");
}

function showToast(message, type = "success") {
  elements.toast.textContent = message;
  elements.toast.classList.remove("success", "error");
  elements.toast.classList.add(type, "show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function showToastSuccess(message) {
  showToast(message, "success");
}

function showToastError(message) {
  showToast(message, "error");
}

function showError(message, error) {
  const detail = error ? getSupabaseErrorMessage(error) : "";
  const finalMessage = detail ? `${message}: ${detail}` : message;
  elements.errorBox.textContent = finalMessage;
  elements.errorBox.hidden = false;
  showToastError(message);
  console.error(message, error || "");
}

function clearError() {
  elements.errorBox.textContent = "";
  elements.errorBox.hidden = true;
}

function closeSystemModal(resolveValue = false) {
  elements.systemModal.classList.remove("is-open");
  window.setTimeout(() => {
    elements.systemModal.hidden = true;
    if (typeof elements.systemModal._resolve === "function") {
      elements.systemModal._resolve(resolveValue);
      elements.systemModal._resolve = null;
    }
  }, 140);
}

function showModalConfirm({
  title = "Confirmar accion",
  message = "",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "warning"
} = {}) {
  elements.systemModalTitle.textContent = title;
  elements.systemModalMessage.textContent = message;
  elements.systemModalConfirm.textContent = confirmText;
  elements.systemModalCancel.textContent = cancelText;
  elements.systemModalIcon.textContent = variant === "success" ? "OK" : "!";
  elements.systemModalIcon.className = `system-modal-icon ${variant}`;
  elements.systemModal.hidden = false;
  window.requestAnimationFrame(() => elements.systemModal.classList.add("is-open"));
  elements.systemModalConfirm.focus();

  return new Promise((resolve) => {
    elements.systemModal._resolve = resolve;
  });
}

function showModalSuccess(title = "Listo", message = "Operacion completada.") {
  elements.systemModalCancel.hidden = true;
  return showModalConfirm({
    title,
    message,
    confirmText: "Cerrar",
    variant: "success"
  }).finally(() => {
    elements.systemModalCancel.hidden = false;
  });
}

function showModalError(title = "No se pudo completar", message = "Revisa el detalle e intenta nuevamente.") {
  elements.systemModalCancel.hidden = true;
  return showModalConfirm({
    title,
    message,
    confirmText: "Cerrar",
    variant: "error"
  }).finally(() => {
    elements.systemModalCancel.hidden = false;
  });
}

function handleSystemModalKeydown(event) {
  if (elements.systemModal.hidden) return;
  if (event.key === "Escape") closeSystemModal(false);
}

function mapSupabaseLot(row) {
  return {
    id: row.lote_id,
    productoId: row.producto_id,
    nombre: row.nombre || "Sin nombre",
    cantidad: Number(row.cantidad_disponible ?? 0),
    unidad: row.unidad || "-",
    fechaVencimiento: row.fecha_vencimiento,
    fechaRecepcion: row.fecha_recepcion,
    lote: row.lote,
    observaciones: row.observaciones,
    stockMinimo: Number(row.stock_minimo ?? 0),
    revisada: Boolean(row.alerta_vencimiento_revisada),
    activo: row.activo !== false
  };
}

async function loadProductsFromSupabase() {
  const { data, error } = await supabaseClient
    .from("productos_insumos")
    .select("id,nombre,nombre_normalizado,unidad_default,stock_minimo,activo")
    .eq("activo", true)
    .is("deleted_at", null)
    .order("nombre", { ascending: true });

  if (error) throw error;
  state.products = (data || []).map((product) => ({
    ...product,
    nombre_normalizado: product.nombre_normalizado || normalize(product.nombre)
  }));
  renderProductSuggestions();
}

async function loadInventoryFromSupabase() {
  await loadProductsFromSupabase();

  const { data, error } = await supabaseClient
    .from("inventario_lotes_disponibles")
    .select("*")
    .gt("cantidad_disponible", 0)
    .eq("activo", true)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const { data: lowStockRows, error: lowStockError } = await supabaseClient
    .from("alertas_stock_minimo")
    .select("*");

  if (lowStockError) throw lowStockError;

  state.inventory = (data || []).map(mapSupabaseLot);
  state.lowStockProducts = lowStockRows || [];
  state.usingFallback = false;
  elements.inventorySourceText.textContent = "Datos reales cargados desde Supabase.";
  clearError();
}

function loadFallbackInventory(error) {
  state.inventory = mockInventory.map((item) => ({ ...item }));
  state.products = mockInventory.map((item) => ({
    id: item.productoId,
    nombre: item.nombre,
    nombre_normalizado: normalize(item.nombre),
    unidad_default: item.unidad,
    stock_minimo: item.stockMinimo,
    activo: true
  }));
  state.lowStockProducts = state.inventory
    .filter((item) => item.cantidad < item.stockMinimo)
    .map((item) => ({ producto_id: item.productoId, nombre: item.nombre, stock_actual: item.cantidad, stock_minimo: item.stockMinimo }));
  state.usingFallback = true;
  renderProductSuggestions();
  elements.inventorySourceText.textContent = "Supabase no respondio correctamente. Mostrando datos mock de respaldo.";
  showError("No se pudo cargar inventario desde Supabase", error);
}

async function refreshInventory() {
  try {
    await loadInventoryFromSupabase();
  } catch (error) {
    loadFallbackInventory(error);
  }
  render();
}

function renderProductSuggestions() {
  const seen = new Set();
  elements.productSuggestions.innerHTML = state.products
    .filter((product) => {
      const key = product.nombre_normalizado || normalize(product.nombre);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((product) => `<option value="${escapeHtml(product.nombre)}" label="${escapeHtml(product.nombre_normalizado || normalize(product.nombre))}"></option>`)
    .join("");
}

function findProductByName(name) {
  const normalized = normalize(name);
  return state.products.find((product) => product.nombre_normalizado === normalized || normalize(product.nombre) === normalized);
}

function maybeAutofillUnit(nameInput, unitInput) {
  const product = findProductByName(nameInput.value);
  if (product?.unidad_default) unitInput.value = product.unidad_default;
}

function getFilteredInventory() {
  const query = normalize(state.query);
  if (!query) return state.inventory;
  return state.inventory.filter((item) => normalize(item.nombre).includes(query));
}

function getAlertItems(items = state.inventory) {
  return items
    .map((item) => ({ ...item, status: getStatus(item) }))
    .filter((item) => ["vencido", "hoy", "proximo"].includes(item.status.key))
    .sort((a, b) => (a.status.days ?? 99999) - (b.status.days ?? 99999));
}

function getLowStockDetailItems() {
  return state.lowStockProducts.map((row) => {
    const productLots = state.inventory.filter((item) => String(item.productoId) === String(row.producto_id));
    const firstLot = productLots[0] || {};
    return {
      id: row.producto_id,
      productoId: row.producto_id,
      nombre: row.nombre || firstLot.nombre || "Producto bajo stock",
      cantidad: Number(row.stock_actual ?? 0),
      unidad: row.unidad_default || firstLot.unidad || "-",
      fechaVencimiento: firstLot.fechaVencimiento || null,
      lote: firstLot.lote || "-",
      observaciones: `Stock minimo: ${row.stock_minimo ?? 0}. Faltante: ${row.faltante ?? "-"}`,
      statusOverride: { key: "proximo", label: "Bajo stock", days: null }
    };
  });
}

function updateMetrics() {
  const withStatus = state.inventory.map((item) => ({ ...item, status: getStatus(item) }));
  const alerts = getAlertItems();
  elements.totalItems.textContent = state.inventory.length;
  elements.soonItems.textContent = withStatus.filter((item) => ["hoy", "proximo"].includes(item.status.key)).length;
  elements.expiredItems.textContent = withStatus.filter((item) => item.status.key === "vencido").length;
  elements.lowStockItems.textContent = state.lowStockProducts.length;
  elements.alertCount.textContent = `${alerts.length} alertas`;
}

function renderAlerts() {
  const alerts = getAlertItems();
  if (!alerts.length) {
    elements.alertsList.innerHTML = '<div class="empty">No hay alertas de vencimiento activas.</div>';
    return;
  }

  elements.alertsList.innerHTML = alerts
    .map((item) => `
      <article class="alert-card">
        <div>
          <div class="alert-title">${escapeHtml(item.nombre)}</div>
          <div class="alert-meta">${item.cantidad} ${escapeHtml(item.unidad)} disponible - lote ${escapeHtml(item.lote || "sin lote")}</div>
          <div class="alert-meta">Recepcion: ${formatDisplayDate(item.fechaRecepcion)}</div>
          <div class="alert-meta">${escapeHtml(item.observaciones || "Sin observaciones")}</div>
        </div>
        <span>${formatDisplayDate(item.fechaVencimiento)}</span>
        ${renderMonthBadge(item.fechaVencimiento)}
        <span>${formatDays(item.status.days)}</span>
        <span class="status ${item.status.key}">${item.status.label}</span>
        <button class="btn" type="button" data-review-id="${item.id}">
          ${item.revisada ? "Revisada" : "Marcar revisada"}
        </button>
      </article>
    `)
    .join("");
}

function renderInventory() {
  const rows = getFilteredInventory();
  if (!rows.length) {
    elements.inventoryTable.innerHTML = '<tr><td colspan="9" class="empty">No se encontraron insumos.</td></tr>';
    return;
  }

  elements.inventoryTable.innerHTML = rows
    .map((item) => {
      const status = getStatus(item);
      return `
        <tr>
          <td><strong>${escapeHtml(item.nombre)}</strong></td>
          <td>${item.cantidad}</td>
          <td>${escapeHtml(item.unidad)}</td>
          <td>${formatDisplayDate(item.fechaVencimiento)}</td>
          <td>${renderMonthBadge(item.fechaVencimiento)}</td>
          <td>${formatDays(status.days)}</td>
          <td>${escapeHtml(item.lote || "-")}</td>
          <td><span class="status ${status.key}">${status.label}</span></td>
          <td class="row-actions">
            <button class="btn small" type="button" data-edit-id="${item.id}">Editar</button>
            <button class="btn small danger-btn" type="button" data-delete-id="${item.id}">Eliminar</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function render() {
  updateMetrics();
  renderAlerts();
  renderInventory();
}

function openEntryModal() {
  elements.entryForm.reset();
  elements.entryForm.elements.fecha_recepcion.value = formatIsoDate(new Date());
  setMonthPreview(elements.entryMonthPreview, "");
  elements.entryModal.hidden = false;
  elements.entryForm.elements.nombre.focus();
}

function closeEntryModal() {
  elements.entryModal.hidden = true;
}

function openEditModal(item) {
  elements.editForm.reset();
  elements.editForm.elements.lote_id.value = item.id;
  elements.editForm.elements.producto_id.value = item.productoId;
  elements.editForm.elements.cantidad_actual.value = item.cantidad;
  elements.editForm.elements.cantidad.value = item.cantidad;
  elements.editForm.elements.unidad.value = item.unidad;
  elements.editForm.elements.fecha_recepcion.value = item.fechaRecepcion || formatIsoDate(new Date());
  elements.editForm.elements.fecha_vencimiento.value = item.fechaVencimiento || "";
  elements.editForm.elements.lote.value = item.lote || "";
  elements.editForm.elements.observaciones.value = item.observaciones || "";
  elements.editProductName.textContent = item.nombre;
  setMonthPreview(elements.editMonthPreview, item.fechaVencimiento);
  elements.editModal.hidden = false;
}

function closeEditModal() {
  elements.editModal.hidden = true;
}

function parseDateInput(value) {
  const clean = value.trim();
  if (!clean) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${month}-${day}`;
  }
  if (/^\d{8}$/.test(clean)) return `${clean.slice(4, 8)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`;
  if (/^\d{6}$/.test(clean)) return `20${clean.slice(4, 6)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`;
  return clean;
}

function isValidIsoDate(value) {
  if (!value) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T00:00:00`);
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day;
}

function getFormPayload(form) {
  const formData = new FormData(form);
  const nombre = formData.get("nombre").trim();
  const cantidad = Number(formData.get("cantidad"));
  const unidad = formData.get("unidad");
  const fechaRecepcion = formData.get("fecha_recepcion");
  const fechaVencimiento = formData.get("fecha_vencimiento") || null;

  if (!nombre) throw new Error("El nombre del producto es obligatorio.");
  if (!cantidad || cantidad <= 0) throw new Error("La cantidad debe ser mayor que cero.");
  if (!unidad) throw new Error("La unidad es obligatoria.");
  if (!fechaRecepcion) throw new Error("La fecha de recepcion es obligatoria.");

  return {
    nombre,
    nombreNormalizado: normalize(nombre),
    cantidad,
    unidad,
    fechaRecepcion,
    fechaVencimiento,
    lote: formData.get("lote").trim() || null,
    observaciones: formData.get("observaciones").trim() || null
  };
}

function validateBulkRow(rawRow) {
  const errors = [];
  const nombre = rawRow.nombre.trim();
  const cantidad = Number(rawRow.cantidad);
  const unidad = rawRow.unidad.trim() || "kg";
  const fechaRecepcion = elements.bulkReceiptDate.value || formatIsoDate(new Date());
  const fechaVencimiento = rawRow.fecha_vencimiento.trim() ? parseDateInput(rawRow.fecha_vencimiento) : null;

  if (!nombre) errors.push("producto obligatorio");
  if (!cantidad || cantidad <= 0) errors.push("cantidad debe ser mayor que cero");
  if (!UNIT_OPTIONS.includes(unidad)) errors.push("unidad invalida");
  if (!isValidIsoDate(fechaRecepcion)) errors.push("fecha recepcion invalida");
  if (fechaVencimiento && !isValidIsoDate(fechaVencimiento)) errors.push("fecha vencimiento invalida");

  return {
    valid: errors.length === 0,
    errors,
    payload: {
      nombre,
      nombreNormalizado: normalize(nombre),
      cantidad,
      unidad,
      fechaRecepcion,
      fechaVencimiento,
      lote: rawRow.lote.trim() || null,
      observaciones: rawRow.observaciones.trim() || null
    }
  };
}

async function findOrCreateProduct(payload) {
  const cached = state.products.find((product) => product.nombre_normalizado === payload.nombreNormalizado);
  if (cached) return cached;

  const { data: existingProduct, error: findError } = await supabaseClient
    .from("productos_insumos")
    .select("id,nombre,nombre_normalizado,unidad_default")
    .eq("nombre_normalizado", payload.nombreNormalizado)
    .maybeSingle();

  if (findError) throw findError;
  if (existingProduct) return existingProduct;

  const { data: createdProduct, error: createError } = await supabaseClient
    .from("productos_insumos")
    .insert({
      nombre: payload.nombre,
      nombre_normalizado: payload.nombreNormalizado,
      unidad_default: payload.unidad,
      stock_minimo: 0,
      activo: true
    })
    .select("id,nombre,nombre_normalizado,unidad_default")
    .single();

  if (createError) throw createError;
  state.products.push(createdProduct);
  renderProductSuggestions();
  return createdProduct;
}

async function createEntry(payload) {
  const product = await findOrCreateProduct(payload);

  const { data: lot, error: lotError } = await supabaseClient
    .from("insumo_lotes")
    .insert({
      producto_id: product.id,
      fecha_recepcion: payload.fechaRecepcion,
      fecha_vencimiento: payload.fechaVencimiento,
      lote: payload.lote,
      unidad: payload.unidad,
      observaciones: payload.observaciones,
      alerta_vencimiento_revisada: false,
      activo: true
    })
    .select("id")
    .single();

  if (lotError) throw lotError;

  const { error: movementError } = await supabaseClient
    .from("movimientos_inventario")
    .insert({
      producto_id: product.id,
      lote_id: lot.id,
      tipo_movimiento: "ingreso",
      cantidad: payload.cantidad,
      unidad: payload.unidad,
      motivo: "Ingreso desde formulario web",
      observacion: payload.observaciones
    });

  if (movementError) throw movementError;
}

async function updateEntry(form) {
  const formData = new FormData(form);
  const loteId = formData.get("lote_id");
  const productoId = formData.get("producto_id");
  const currentQuantity = Number(formData.get("cantidad_actual"));
  const nextQuantity = Number(formData.get("cantidad"));
  const unidad = formData.get("unidad");
  const fechaRecepcion = formData.get("fecha_recepcion");
  const fechaVencimiento = formData.get("fecha_vencimiento") || null;
  const lote = formData.get("lote").trim() || null;
  const observaciones = formData.get("observaciones").trim() || null;

  if (nextQuantity < 0) throw new Error("La cantidad no puede ser negativa.");

  const { error: lotError } = await supabaseClient
    .from("insumo_lotes")
    .update({
      fecha_recepcion: fechaRecepcion,
      fecha_vencimiento: fechaVencimiento,
      lote,
      unidad,
      observaciones
    })
    .eq("id", loteId);

  if (lotError) throw lotError;

  const delta = Number((nextQuantity - currentQuantity).toFixed(3));
  if (delta === 0) return;

  const movementType = delta > 0 ? "ingreso" : "eliminacion";
  const { error: movementError } = await supabaseClient
    .from("movimientos_inventario")
    .insert({
      producto_id: productoId,
      lote_id: loteId,
      tipo_movimiento: movementType,
      cantidad: Math.abs(delta),
      unidad,
      motivo: "Ajuste manual desde edicion",
      observacion: observaciones
    });

  if (movementError) throw movementError;
}

async function deleteEntry(id) {
  const item = state.inventory.find((entry) => String(entry.id) === String(id));
  if (!item) return;
  const confirmed = await showModalConfirm({
    title: "Eliminar lote",
    message: `Eliminar el lote de ${item.nombre}? Se marcara inactivo y se registrara movimiento de eliminacion.`,
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    variant: "error"
  });
  if (!confirmed) return;

  if (state.usingFallback) {
    state.inventory = state.inventory.filter((entry) => String(entry.id) !== String(id));
    render();
    showToastSuccess("Lote eliminado.");
    return;
  }

  const { error: movementError } = await supabaseClient
    .from("movimientos_inventario")
    .insert({
      producto_id: item.productoId,
      lote_id: item.id,
      tipo_movimiento: "eliminacion",
      cantidad: item.cantidad,
      unidad: item.unidad,
      motivo: "Eliminacion logica desde inventario",
      observacion: item.observaciones
    });

  if (movementError) {
    showError("No se pudo crear movimiento de eliminacion", movementError);
    return;
  }

  const { error: lotError } = await supabaseClient
    .from("insumo_lotes")
    .update({ activo: false, deleted_at: new Date().toISOString() })
    .eq("id", item.id);

  if (lotError) {
    showError("No se pudo marcar el lote como inactivo", lotError);
    return;
  }

  await refreshInventory();
  showToastSuccess("Lote eliminado.");
}

function createBulkInput(name, type = "text", value = "") {
  const input = document.createElement(type === "select" ? "select" : "input");
  input.dataset.field = name;
  input.className = "bulk-input";

  if (type === "select") {
    UNIT_OPTIONS.forEach((unit) => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit;
      input.appendChild(option);
    });
    input.value = value || "kg";
    return input;
  }

  input.type = type;
  input.value = value;
  if (name === "nombre") {
    input.setAttribute("list", "productSuggestions");
    input.autocomplete = "off";
  }
  if (name === "cantidad") {
    input.min = "0.001";
    input.step = "0.001";
  }
  return input;
}

function addBulkRow(values = {}, focusFirst = false) {
  const tr = document.createElement("tr");
  BULK_COLUMNS.forEach((column) => {
    const td = document.createElement("td");
    const type = column === "cantidad" ? "number" : column === "unidad" ? "select" : column.startsWith("fecha") ? "date" : "text";
    td.appendChild(createBulkInput(column, type, values[column] ?? ""));
    tr.appendChild(td);
    if (column === "fecha_vencimiento") {
      const monthTd = document.createElement("td");
      monthTd.className = "bulk-month-cell";
      monthTd.innerHTML = "";
      tr.appendChild(monthTd);
    }
  });

  const errorTd = document.createElement("td");
  errorTd.className = "bulk-row-error";
  errorTd.hidden = true;
  tr.appendChild(errorTd);
  elements.bulkTableBody.appendChild(tr);

  if (focusFirst) tr.querySelector(".bulk-input").focus();
  return tr;
}

function ensureBulkRows() {
  elements.bulkTableBody.innerHTML = "";
  for (let i = 0; i < 5; i += 1) addBulkRow();
}

function openBulkModal() {
  ensureBulkRows();
  elements.bulkReceiptDate.value = formatIsoDate(new Date());
  elements.bulkErrorList.hidden = true;
  elements.bulkErrorList.innerHTML = "";
  elements.bulkModal.hidden = false;
  elements.bulkTableBody.querySelector(".bulk-input")?.focus();
}

function closeBulkModal() {
  elements.bulkModal.hidden = true;
}

function getBulkRows() {
  return [...elements.bulkTableBody.querySelectorAll("tr")].map((tr) => {
    const row = {};
    BULK_COLUMNS.forEach((column) => {
      row[column] = tr.querySelector(`[data-field="${column}"]`).value;
    });
    return { tr, row };
  });
}

function isBulkRowEmpty(row) {
  return BULK_COLUMNS.every((column) => !row[column].trim());
}

function markBulkValidation(results) {
  const messages = [];
  results.forEach((result) => {
    result.tr.classList.toggle("row-invalid", !result.valid);
    const errorCell = result.tr.querySelector(".bulk-row-error");
    errorCell.hidden = result.valid;
    errorCell.textContent = result.valid ? "" : result.errors.join(", ");
    if (!result.valid) messages.push(`Fila ${result.index}: ${result.errors.join(", ")}`);
  });

  elements.bulkErrorList.hidden = messages.length === 0;
  elements.bulkErrorList.innerHTML = messages.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
}

function validateBulkRows() {
  const rows = getBulkRows().filter(({ row }) => !isBulkRowEmpty(row));
  const results = rows.map(({ tr, row }, index) => ({
    tr,
    index: index + 1,
    ...validateBulkRow(row)
  }));
  markBulkValidation(results);
  return results;
}

function moveToNextBulkInput(currentInput) {
  const inputs = [...elements.bulkTableBody.querySelectorAll(".bulk-input")];
  const currentIndex = inputs.indexOf(currentInput);
  const next = inputs[currentIndex + 1];
  if (next) {
    next.focus();
    next.select?.();
    return;
  }
  addBulkRow({}, true);
}

function pasteExcelData(event) {
  const target = event.target.closest(".bulk-input");
  if (!target) return;
  const text = event.clipboardData.getData("text");
  if (!text.includes("\t") && !text.includes("\n")) return;
  event.preventDefault();

  const rows = text.trimEnd().split(/\r?\n/).map((line) => line.split("\t"));
  const startCell = target.closest("td");
  const startRow = target.closest("tr");
  const startRowIndex = [...elements.bulkTableBody.children].indexOf(startRow);
  const startColumnIndex = [...startRow.children].filter((cell) => !cell.classList.contains("bulk-month-cell")).indexOf(startCell);

  rows.forEach((cells, rowOffset) => {
    while (elements.bulkTableBody.children.length <= startRowIndex + rowOffset) addBulkRow();
    const row = elements.bulkTableBody.children[startRowIndex + rowOffset];
    cells.forEach((cellValue, columnOffset) => {
      const columnName = BULK_COLUMNS[startColumnIndex + columnOffset];
      if (!columnName) return;
      const input = row.querySelector(`[data-field="${columnName}"]`);
      if (!input) return;
      input.value = columnName.startsWith("fecha") ? parseDateInput(cellValue) || "" : cellValue.trim();
      if (columnName === "nombre") maybeAutofillUnit(input, row.querySelector('[data-field="unidad"]'));
      if (columnName === "fecha_vencimiento") row.querySelector(".bulk-month-cell").innerHTML = renderMonthBadge(input.value);
    });
  });
}

async function markAlertReviewed(id) {
  if (state.usingFallback) {
    const item = state.inventory.find((entry) => String(entry.id) === String(id));
    if (item) item.revisada = true;
    render();
    showToastSuccess("Alerta revisada en modo mock. El inventario no fue modificado.");
    return;
  }

  const { error } = await supabaseClient
    .from("insumo_lotes")
    .update({ alerta_vencimiento_revisada: true })
    .eq("id", id);

  if (error) {
    showError("No se pudo marcar la alerta como revisada", error);
    return;
  }

  await refreshInventory();
  showToastSuccess("Cambios actualizados.");
}

function getDetailItems(type) {
  if (type === "total") return state.inventory;
  if (type === "soon") return state.inventory.filter((item) => ["hoy", "proximo"].includes(getStatus(item).key));
  if (type === "expired") return state.inventory.filter((item) => getStatus(item).key === "vencido");
  if (type === "lowstock") return getLowStockDetailItems();
  return [];
}

function openDetailModal(type) {
  const titles = {
    total: "Total insumos",
    soon: "Proximos a vencer",
    expired: "Vencidos",
    lowstock: "Bajo stock"
  };
  const items = getDetailItems(type);
  elements.detailModalTitle.textContent = titles[type] || "Detalle";
  elements.detailTableBody.innerHTML = items.length
    ? items.map((item) => {
        const status = item.statusOverride || getStatus(item);
        return `
          <tr>
            <td><strong>${escapeHtml(item.nombre)}</strong></td>
            <td>${item.cantidad}</td>
            <td>${escapeHtml(item.unidad)}</td>
            <td>${formatDisplayDate(item.fechaVencimiento)}</td>
            <td>${renderMonthBadge(item.fechaVencimiento)}</td>
            <td>${formatDays(status.days)}</td>
            <td>${escapeHtml(item.lote || "-")}</td>
            <td>${escapeHtml(item.observaciones || "-")}</td>
            <td><span class="status ${status.key}">${status.label}</span></td>
          </tr>
        `;
      }).join("")
    : '<tr><td colspan="9" class="empty">No hay datos para este filtro.</td></tr>';
  elements.detailModal.hidden = false;
}

function closeDetailModal() {
  elements.detailModal.hidden = true;
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderInventory();
});

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-review-id]");
  if (reviewButton) {
    markAlertReviewed(reviewButton.dataset.reviewId);
    return;
  }

  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    const item = state.inventory.find((entry) => String(entry.id) === String(editButton.dataset.editId));
    if (item) openEditModal(item);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    deleteEntry(deleteButton.dataset.deleteId);
    return;
  }

  const detailButton = event.target.closest("[data-detail]");
  if (detailButton) openDetailModal(detailButton.dataset.detail);
});

elements.systemModalCancel.addEventListener("click", () => closeSystemModal(false));
elements.systemModalConfirm.addEventListener("click", () => closeSystemModal(true));
elements.systemModal.addEventListener("click", (event) => {
  if (event.target === elements.systemModal) closeSystemModal(false);
});
document.addEventListener("keydown", handleSystemModalKeydown);

document.getElementById("newEntryBtn").addEventListener("click", openEntryModal);
document.getElementById("closeEntryModal").addEventListener("click", closeEntryModal);
document.getElementById("cancelEntry").addEventListener("click", closeEntryModal);
elements.entryModal.addEventListener("click", (event) => {
  if (event.target === elements.entryModal) closeEntryModal();
});

elements.entryForm.elements.nombre.addEventListener("input", () => {
  maybeAutofillUnit(elements.entryForm.elements.nombre, elements.entryForm.elements.unidad);
});
elements.entryForm.elements.fecha_vencimiento.addEventListener("input", (event) => {
  setMonthPreview(elements.entryMonthPreview, event.target.value);
});
elements.entryForm.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target.tagName !== "TEXTAREA") {
    const fields = [...elements.entryForm.querySelectorAll("input, select, textarea, button")].filter((field) => !field.disabled && field.type !== "hidden");
    const index = fields.indexOf(event.target);
    if (index >= 0 && index < fields.length - 1) {
      event.preventDefault();
      fields[index + 1].focus();
    }
  }
});
elements.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  elements.saveEntryBtn.disabled = true;
  elements.saveEntryBtn.textContent = "Guardando...";
  try {
    await createEntry(getFormPayload(elements.entryForm));
    closeEntryModal();
    showToastSuccess("Guardadito.");
    await refreshInventory();
  } catch (error) {
    showError("No se pudo guardar el ingreso", error);
  } finally {
    elements.saveEntryBtn.disabled = false;
    elements.saveEntryBtn.textContent = "Guardar ingreso";
  }
});

document.getElementById("closeEditModal").addEventListener("click", closeEditModal);
document.getElementById("cancelEdit").addEventListener("click", closeEditModal);
elements.editModal.addEventListener("click", (event) => {
  if (event.target === elements.editModal) closeEditModal();
});
elements.editForm.elements.fecha_vencimiento.addEventListener("input", (event) => {
  setMonthPreview(elements.editMonthPreview, event.target.value);
});
elements.editForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  elements.saveEditBtn.disabled = true;
  elements.saveEditBtn.textContent = "Guardando...";
  try {
    await updateEntry(elements.editForm);
    closeEditModal();
    showToastSuccess("Guardadito.");
    await refreshInventory();
  } catch (error) {
    showError("No se pudo editar el ingreso", error);
  } finally {
    elements.saveEditBtn.disabled = false;
    elements.saveEditBtn.textContent = "Guardar cambios";
  }
});

document.getElementById("bulkEntryBtn").addEventListener("click", openBulkModal);
document.getElementById("closeBulkModal").addEventListener("click", closeBulkModal);
document.getElementById("cancelBulk").addEventListener("click", closeBulkModal);
document.getElementById("addBulkRow").addEventListener("click", () => addBulkRow({}, true));
elements.bulkModal.addEventListener("click", (event) => {
  if (event.target === elements.bulkModal) closeBulkModal();
});
elements.bulkTableBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const input = event.target.closest(".bulk-input");
  if (!input) return;
  event.preventDefault();
  moveToNextBulkInput(input);
});
elements.bulkTableBody.addEventListener("input", (event) => {
  const input = event.target.closest(".bulk-input");
  if (!input) return;
  const row = input.closest("tr");
  if (input.dataset.field === "nombre") maybeAutofillUnit(input, row.querySelector('[data-field="unidad"]'));
  if (input.dataset.field === "fecha_vencimiento") row.querySelector(".bulk-month-cell").innerHTML = renderMonthBadge(input.value);
});
elements.bulkTableBody.addEventListener("paste", pasteExcelData);
elements.saveBulkBtn.addEventListener("click", async () => {
  clearError();
  const results = validateBulkRows();
  const validRows = results.filter((result) => result.valid);

  if (!results.length) {
    elements.bulkErrorList.hidden = false;
    elements.bulkErrorList.innerHTML = "<div>Agrega al menos una fila antes de guardar.</div>";
    return;
  }
  if (!validRows.length) {
    showToastError("No hay filas validas para guardar.");
    return;
  }

  elements.saveBulkBtn.disabled = true;
  elements.saveBulkBtn.textContent = "Guardando...";
  let saved = 0;
  const saveErrors = [];

  for (const row of validRows) {
    try {
      await createEntry(row.payload);
      saved += 1;
    } catch (error) {
      row.tr.classList.add("row-invalid");
      const errorCell = row.tr.querySelector(".bulk-row-error");
      errorCell.hidden = false;
      errorCell.textContent = getSupabaseErrorMessage(error);
      saveErrors.push(`Fila ${row.index}: ${getSupabaseErrorMessage(error)}`);
    }
  }

  if (saveErrors.length) {
    elements.bulkErrorList.hidden = false;
    elements.bulkErrorList.innerHTML = saveErrors.map((message) => `<div>${escapeHtml(message)}</div>`).join("");
    showError("Algunas filas no se pudieron guardar", { message: saveErrors.join(" | ") });
  }
  if (saved > 0) {
    showToastSuccess("Guardadito.");
    await refreshInventory();
  }
  if (saved === validRows.length) closeBulkModal();
  elements.saveBulkBtn.disabled = false;
  elements.saveBulkBtn.textContent = "Guardar filas validas";
});

document.getElementById("closeDetailModal").addEventListener("click", closeDetailModal);
elements.detailModal.addEventListener("click", (event) => {
  if (event.target === elements.detailModal) closeDetailModal();
});

document.getElementById("importBtn").addEventListener("click", () => {
  showToastSuccess("Importacion desde foto/Excel queda pendiente.");
});

refreshInventory();




