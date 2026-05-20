const SUPABASE_URL = "https://wsnnhczdhiysghstplki.supabase.co";

const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indzbm5oY3pkaGl5c2doc3RwbGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDU3ODYsImV4cCI6MjA5NDg4MTc4Nn0.wDawAny58YsXgNgPaV6oKzQD4QdFdLYO8vomVFVKGAQ";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const DAY_MS = 24 * 60 * 60 * 1000;
const BULK_COLUMNS = [
  "nombre",
  "cantidad",
  "unidad",
  "fecha_recepcion",
  "fecha_vencimiento",
  "lote",
  "proveedor",
  "observaciones"
];
const UNIT_OPTIONS = ["kg", "g", "lt", "ml", "unidad", "caja", "paquete"];

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
    proveedor: "Molinos Sur",
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
    proveedor: "Distribuidora Centro",
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
    proveedor: "Lacteos Valle",
    observaciones: "Prioridad de consumo",
    stockMinimo: 10,
    revisada: false
  }
];

const state = {
  query: "",
  inventory: [],
  lowStockCount: 0,
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
  entryModal: document.getElementById("entryModal"),
  entryForm: document.getElementById("entryForm"),
  saveEntryBtn: document.getElementById("saveEntryBtn"),
  bulkModal: document.getElementById("bulkModal"),
  bulkTableBody: document.getElementById("bulkTableBody"),
  bulkErrorList: document.getElementById("bulkErrorList"),
  saveBulkBtn: document.getElementById("saveBulkBtn")
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

function escapeHtml(value) {
  return value
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

function showError(message, error) {
  const detail = error ? getSupabaseErrorMessage(error) : "";
  elements.errorBox.textContent = detail ? `${message}: ${detail}` : message;
  elements.errorBox.hidden = false;
  console.error(message, error || "");
}

function clearError() {
  elements.errorBox.textContent = "";
  elements.errorBox.hidden = true;
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => elements.toast.classList.remove("show"), 2600);
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
    proveedor: row.proveedor,
    observaciones: row.observaciones,
    stockMinimo: Number(row.stock_minimo ?? 0),
    revisada: Boolean(row.alerta_vencimiento_revisada)
  };
}

async function loadInventoryFromSupabase() {
  const { data, error } = await supabaseClient
    .from("inventario_lotes_disponibles")
    .select("*")
    .gt("cantidad_disponible", 0)
    .order("fecha_vencimiento", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const { data: lowStockRows, error: lowStockError } = await supabaseClient
    .from("alertas_stock_minimo")
    .select("producto_id");

  if (lowStockError) throw lowStockError;

  state.inventory = (data || []).map(mapSupabaseLot);
  state.lowStockCount = (lowStockRows || []).length;
  state.usingFallback = false;
  elements.inventorySourceText.textContent = "Datos reales cargados desde Supabase.";
  clearError();
}

function loadFallbackInventory(error) {
  state.inventory = mockInventory.map((item) => ({ ...item }));
  state.lowStockCount = state.inventory.filter((item) => item.cantidad < item.stockMinimo).length;
  state.usingFallback = true;
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

function updateMetrics() {
  const withStatus = state.inventory.map((item) => ({ ...item, status: getStatus(item) }));
  const alerts = getAlertItems();
  elements.totalItems.textContent = state.inventory.length;
  elements.soonItems.textContent = withStatus.filter((item) => ["hoy", "proximo"].includes(item.status.key)).length;
  elements.expiredItems.textContent = withStatus.filter((item) => item.status.key === "vencido").length;
  elements.lowStockItems.textContent = state.lowStockCount;
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
          <div class="alert-meta">Proveedor: ${escapeHtml(item.proveedor || "sin proveedor")} - Recepcion: ${formatDisplayDate(item.fechaRecepcion)}</div>
          <div class="alert-meta">${escapeHtml(item.observaciones || "Sin observaciones")}</div>
        </div>
        <span>${formatDisplayDate(item.fechaVencimiento)}</span>
        <span>${formatDays(item.status.days)}</span>
        <span class="status ${item.status.key}">${item.status.label}</span>
        <button class="btn" type="button" data-review-id="${item.id}">
          ${item.revisada ? "Revisada" : "Marcar revisada"}
        </button>
        ${item.revisada ? '<span class="reviewed">Alerta revisada</span>' : ""}
      </article>
    `)
    .join("");
}

function renderInventory() {
  const rows = getFilteredInventory();
  if (!rows.length) {
    elements.inventoryTable.innerHTML = '<tr><td colspan="8" class="empty">No se encontraron insumos.</td></tr>';
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
          <td>${formatDays(status.days)}</td>
          <td>${escapeHtml(item.lote || "-")}</td>
          <td>${escapeHtml(item.proveedor || "-")}</td>
          <td><span class="status ${status.key}">${status.label}</span></td>
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
  elements.entryModal.hidden = false;
  elements.entryForm.elements.nombre.focus();
}

function closeEntryModal() {
  elements.entryModal.hidden = true;
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
    proveedor: formData.get("proveedor").trim() || null,
    observaciones: formData.get("observaciones").trim() || null
  };
}

function validateBulkRow(rawRow) {
  const errors = [];
  const nombre = rawRow.nombre.trim();
  const cantidad = Number(rawRow.cantidad);
  const unidad = rawRow.unidad.trim() || "kg";
  const fechaRecepcion = parseDateInput(rawRow.fecha_recepcion || formatIsoDate(new Date()));
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
      proveedor: rawRow.proveedor.trim() || null,
      observaciones: rawRow.observaciones.trim() || null
    }
  };
}

async function findOrCreateProduct(payload) {
  const { data: existingProduct, error: findError } = await supabaseClient
    .from("productos_insumos")
    .select("id")
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
    .select("id")
    .single();

  if (createError) throw createError;
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
      proveedor: payload.proveedor,
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
    const defaultValue = column === "fecha_recepcion" ? formatIsoDate(new Date()) : "";
    td.appendChild(createBulkInput(column, type, values[column] ?? defaultValue));
    tr.appendChild(td);
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
  const startColumnIndex = [...startRow.children].indexOf(startCell);

  rows.forEach((cells, rowOffset) => {
    while (elements.bulkTableBody.children.length <= startRowIndex + rowOffset) {
      addBulkRow();
    }

    const row = elements.bulkTableBody.children[startRowIndex + rowOffset];
    cells.forEach((cellValue, columnOffset) => {
      const columnName = BULK_COLUMNS[startColumnIndex + columnOffset];
      if (!columnName) return;
      const input = row.querySelector(`[data-field="${columnName}"]`);
      if (input) input.value = columnName.startsWith("fecha") ? parseDateInput(cellValue) || "" : cellValue.trim();
    });
  });
}

async function markAlertReviewed(id) {
  if (state.usingFallback) {
    const item = state.inventory.find((entry) => String(entry.id) === String(id));
    if (item) item.revisada = true;
    render();
    showToast("Alerta revisada en modo mock. El inventario no fue modificado.");
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
  showToast("Alerta marcada como revisada. El stock no fue modificado.");
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderInventory();
});

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-review-id]");
  if (!reviewButton) return;
  markAlertReviewed(reviewButton.dataset.reviewId);
});

document.getElementById("newEntryBtn").addEventListener("click", openEntryModal);
document.getElementById("closeEntryModal").addEventListener("click", closeEntryModal);
document.getElementById("cancelEntry").addEventListener("click", closeEntryModal);
elements.entryModal.addEventListener("click", (event) => {
  if (event.target === elements.entryModal) closeEntryModal();
});

elements.entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  elements.saveEntryBtn.disabled = true;
  elements.saveEntryBtn.textContent = "Guardando...";

  try {
    await createEntry(getFormPayload(elements.entryForm));
    closeEntryModal();
    showToast("Ingreso guardado correctamente en Supabase.");
    await refreshInventory();
  } catch (error) {
    showError("No se pudo guardar el ingreso", error);
  } finally {
    elements.saveEntryBtn.disabled = false;
    elements.saveEntryBtn.textContent = "Guardar ingreso";
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
    showToast("No hay filas validas para guardar.");
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
    showToast(`${saved} filas guardadas correctamente.`);
    await refreshInventory();
  }

  if (saved === validRows.length) closeBulkModal();

  elements.saveBulkBtn.disabled = false;
  elements.saveBulkBtn.textContent = "Guardar filas validas";
});

document.getElementById("importBtn").addEventListener("click", () => {
  showToast("Importacion desde foto/Excel queda pendiente. Prioridad actual: ingreso masivo.");
});

refreshInventory();
