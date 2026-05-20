const DAY_MS = 24 * 60 * 60 * 1000;

const formatIsoDate = (date) => date.toISOString().slice(0, 10);

const addDays = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return formatIsoDate(date);
};

const inventory = [
  {
    id: 1,
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
  },
  {
    id: 4,
    nombre: "Aceite vegetal",
    cantidad: 14,
    unidad: "lt",
    fechaVencimiento: addDays(80),
    fechaRecepcion: addDays(-10),
    lote: "AC-778",
    proveedor: "Mayorista Norte",
    observaciones: "Vigente",
    stockMinimo: 10,
    revisada: false
  },
  {
    id: 5,
    nombre: "Chocolate cobertura",
    cantidad: 5,
    unidad: "kg",
    fechaVencimiento: addDays(19),
    fechaRecepcion: addDays(-12),
    lote: "CH-052",
    proveedor: "Cacao Pro",
    observaciones: "Bajo stock",
    stockMinimo: 8,
    revisada: false
  },
  {
    id: 6,
    nombre: "Sal fina",
    cantidad: 30,
    unidad: "kg",
    fechaVencimiento: null,
    fechaRecepcion: addDays(-60),
    lote: "SF-011",
    proveedor: "Salinas",
    observaciones: "Sin vencimiento declarado",
    stockMinimo: 6,
    revisada: false
  }
];

const state = {
  query: ""
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
  toast: document.getElementById("toast")
};

function normalize(text) {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
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

  if (days === null) {
    return {
      key: "sin-fecha",
      label: "Sin fecha",
      days
    };
  }

  if (days < 0) {
    return {
      key: "vencido",
      label: "Vencido",
      days
    };
  }

  if (days === 0) {
    return {
      key: "hoy",
      label: "Vence hoy",
      days
    };
  }

  if (days <= 20) {
    return {
      key: "proximo",
      label: "Proximo a vencer",
      days
    };
  }

  return {
    key: "vigente",
    label: "Vigente",
    days
  };
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

function getFilteredInventory() {
  const query = normalize(state.query);
  if (!query) return inventory;
  return inventory.filter((item) => normalize(item.nombre).includes(query));
}

function getAlertItems(items = inventory) {
  return items
    .map((item) => ({ ...item, status: getStatus(item) }))
    .filter((item) => ["vencido", "hoy", "proximo"].includes(item.status.key))
    .sort((a, b) => {
      const aDays = a.status.days ?? Number.MAX_SAFE_INTEGER;
      const bDays = b.status.days ?? Number.MAX_SAFE_INTEGER;
      return aDays - bDays;
    });
}

function updateMetrics() {
  const withStatus = inventory.map((item) => ({ ...item, status: getStatus(item) }));
  const alerts = getAlertItems();

  elements.totalItems.textContent = inventory.length;
  elements.soonItems.textContent = withStatus.filter((item) => ["hoy", "proximo"].includes(item.status.key)).length;
  elements.expiredItems.textContent = withStatus.filter((item) => item.status.key === "vencido").length;
  elements.lowStockItems.textContent = inventory.filter((item) => item.cantidad < item.stockMinimo).length;
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
          <div class="alert-title">${item.nombre}</div>
          <div class="alert-meta">${item.cantidad} ${item.unidad} disponible Â· lote ${item.lote || "sin lote"}</div>
          <div class="alert-meta">Proveedor: ${item.proveedor || "sin proveedor"} Â· Recepcion: ${formatDisplayDate(item.fechaRecepcion)}</div>
          <div class="alert-meta">${item.observaciones || "Sin observaciones"}</div>
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
          <td><strong>${item.nombre}</strong></td>
          <td>${item.cantidad}</td>
          <td>${item.unidad}</td>
          <td>${formatDisplayDate(item.fechaVencimiento)}</td>
          <td>${formatDays(status.days)}</td>
          <td>${item.lote || "-"}</td>
          <td>${item.proveedor || "-"}</td>
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

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

elements.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderInventory();
});

document.addEventListener("click", (event) => {
  const reviewButton = event.target.closest("[data-review-id]");
  if (!reviewButton) return;

  const item = inventory.find((entry) => entry.id === Number(reviewButton.dataset.reviewId));
  if (!item) return;

  item.revisada = true;
  render();
  showToast(`Alerta revisada: ${item.nombre}. El inventario no fue modificado.`);
});

document.getElementById("newEntryBtn").addEventListener("click", () => {
  showToast("Nuevo ingreso: flujo pendiente de conectar a Supabase.");
});

document.getElementById("bulkEntryBtn").addEventListener("click", () => {
  showToast("Ingreso masivo: tabla operativa pendiente de desarrollo.");
});

document.getElementById("importBtn").addEventListener("click", () => {
  showToast("Importacion: los datos deben quedar como borrador antes de guardar.");
});

render();
