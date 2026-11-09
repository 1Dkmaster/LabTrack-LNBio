const STORAGE_KEY = "labtrack-lnbio-v1";

const defaultEquipment = [
  {
    id: "BAL-001",
    name: "Balança Analítica XP205",
    category: "Balança",
    location: "Sala A12",
    manufacturer: "Mettler Toledo",
    assetNumber: "LNBIO-00045",
    serial: "XP205-789456",
    acquisitionYear: 2023,
    status: "Operacional",
    responsible: "Equipe Operações",
    publicUrl: "https://labtrack.lnbio/equipamento/BAL-001",
    qrCode: "QR-BAL-001",
    lastCleaning: "2027-07-25",
    lastInspection: "2027-07-25",
    lastCalibration: "2027-06-15",
    nextCalibration: "2027-12-15",
    technical: {
      modelo: "XP205",
      capacidade: "220 g",
      resolucao: "0,01 mg",
      peso: "7 kg",
      localizacao: "Laboratório LOA",
      manual: "Abrir",
      pop: "Abrir"
    },
    activities: [
      {
        id: crypto.randomUUID(),
        date: "2027-07-25",
        type: "Limpeza",
        responsible: "Edson",
        status: "Operacional",
        notes: "Pequeno acúmulo de poeira removido na base."
      },
      {
        id: crypto.randomUUID(),
        date: "2027-07-25",
        type: "Inspeção",
        responsible: "Edson",
        status: "Operacional",
        notes: "Verificação visual concluída e equipamento em conformidade."
      },
      {
        id: crypto.randomUUID(),
        date: "2027-06-15",
        type: "Calibração",
        responsible: "Empresa",
        status: "Operacional",
        notes: "Calibração externa realizada conforme procedimento da área."
      }
    ]
  },
  {
    id: "CEN-004",
    name: "Centrífuga 5810",
    category: "Centrífuga",
    location: "Sala C02",
    manufacturer: "Eppendorf",
    assetNumber: "LNBIO-00210",
    serial: "5810-1147",
    acquisitionYear: 2022,
    status: "Atenção",
    responsible: "Equipe Operações",
    publicUrl: "https://labtrack.lnbio/equipamento/CEN-004",
    qrCode: "QR-CEN-004",
    lastCleaning: "2027-07-20",
    lastInspection: "2027-07-18",
    lastCalibration: "2027-05-12",
    nextCalibration: "2027-11-30",
    technical: {
      modelo: "5810",
      capacidade: "15 mL / 50 mL",
      resolucao: "—",
      peso: "18 kg",
      localizacao: "Laboratório de Biologia",
      manual: "Abrir",
      pop: "Abrir"
    },
    activities: [
      {
        id: crypto.randomUUID(),
        date: "2027-07-20",
        type: "Limpeza",
        responsible: "Felipe",
        status: "Atenção",
        notes: "Rotação verificou leve acúmulo de resíduos na tampa."
      },
      {
        id: crypto.randomUUID(),
        date: "2027-07-18",
        type: "Inspeção",
        responsible: "Edson",
        status: "Atenção",
        notes: "Tampa e vedação conferidas; manter acompanhamento."
      }
    ]
  },
  {
    id: "FRE-012",
    name: "Freezer -80°C",
    category: "Freezer",
    location: "Sala B08",
    manufacturer: "Thermo Scientific",
    assetNumber: "LNBIO-00088",
    serial: "TFS-8803",
    acquisitionYear: 2021,
    status: "Operacional",
    responsible: "Equipe Operações",
    publicUrl: "https://labtrack.lnbio/equipamento/FRE-012",
    qrCode: "QR-FRE-012",
    lastCleaning: "2027-07-22",
    lastInspection: "2027-07-22",
    lastCalibration: "2027-04-10",
    nextCalibration: "2027-10-10",
    technical: {
      modelo: "TSX Series",
      capacidade: "687 L",
      resolucao: "—",
      peso: "290 kg",
      localizacao: "Laboratório Central",
      manual: "Abrir",
      pop: "Abrir"
    },
    activities: [
      {
        id: crypto.randomUUID(),
        date: "2027-07-22",
        type: "Limpeza",
        responsible: "Edson",
        status: "Operacional",
        notes: "Limpeza externa e verificação de temperatura concluída."
      },
      {
        id: crypto.randomUUID(),
        date: "2027-07-22",
        type: "Inspeção",
        responsible: "Edson",
        status: "Operacional",
        notes: "Acesso lateral e sistema de vedação conferidos."
      }
    ]
  }
];

let state = {
  role: "operador",
  equipment: loadEquipment(),
  selectedId: null,
  currentTab: "records",
  search: ""
};

const els = {
  roleSelect: document.querySelector("#roleSelect"),
  equipmentList: document.querySelector("#equipmentList"),
  dashboardMetrics: document.querySelector("#dashboardMetrics"),
  alertList: document.querySelector("#alertList"),
  searchInput: document.querySelector("#searchInput"),
  equipmentName: document.querySelector("#equipmentName"),
  tabContent: document.querySelector("#tabContent"),
  equipmentOverview: document.querySelector("#equipmentOverview"),
  equipmentActions: document.querySelector("#equipmentActions"),
  publicStatusCard: document.querySelector("#publicStatusCard"),
  activityBtn: document.querySelector("#activityBtn"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  activityForm: document.querySelector("#activityForm"),
  modalTitle: document.querySelector("#modalTitle"),
  cancelActivityBtn: document.querySelector("#cancelActivityBtn"),
  closeModalBtn: document.querySelector("#closeModalBtn"),
  newEquipmentBtn: document.querySelector("#newEquipmentBtn"),
  newEquipmentModal: document.querySelector("#newEquipmentModal"),
  equipmentForm: document.querySelector("#equipmentForm"),
  closeNewEquipmentBtn: document.querySelector("#closeNewEquipmentBtn"),
  cancelEquipmentBtn: document.querySelector("#cancelEquipmentBtn"),
  dashboardView: document.querySelector("#dashboardView"),
  equipmentView: document.querySelector("#equipmentView"),
  publicView: document.querySelector("#publicView")
};

const tabButtons = [...document.querySelectorAll(".tab-btn")];

function loadEquipment() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultEquipment));
    return defaultEquipment;
  }

  try {
    const parsed = JSON.parse(saved);
    return parsed.length ? parsed : defaultEquipment;
  } catch {
    return defaultEquipment;
  }
}

function saveEquipment() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.equipment));
}

function statusClass(status) {
  if (status === "Operacional") return "success";
  if (status === "Atenção") return "warning";
  return "danger";
}

function getSelectedEquipment() {
  return state.equipment.find(item => item.id === state.selectedId) || state.equipment[0];
}

function getFilteredEquipment() {
  const query = state.search.trim().toLowerCase();
  return state.equipment.filter(item => {
    if (!query) return true;
    return `${item.name} ${item.category} ${item.location} ${item.id}`.toLowerCase().includes(query);
  });
}

function renderDashboard() {
  const total = state.equipment.length;
  const conforming = state.equipment.filter(item => item.status === "Operacional").length;
  const pendingCleaning = state.equipment.filter(item => {
    const lastCleaning = new Date(item.lastCleaning || "2020-01-01");
    const now = new Date();
    const diff = (now - lastCleaning) / (1000 * 60 * 60 * 24);
    return diff > 30;
  }).length;
  const pendingInspection = state.equipment.filter(item => {
    const lastInspection = new Date(item.lastInspection || "2020-01-01");
    const now = new Date();
    const diff = (now - lastInspection) / (1000 * 60 * 60 * 24);
    return diff > 45;
  }).length;
  const calibrationSoon = state.equipment.filter(item => {
    const nextCalibration = new Date(item.nextCalibration || "2020-01-01");
    const now = new Date();
    const diff = (nextCalibration - now) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 45;
  }).length;

  const metrics = [
    { label: "Equipamentos cadastrados", value: total, trend: "Base atual" },
    { label: "Em conformidade", value: conforming, trend: `${Math.round((conforming / Math.max(total, 1)) * 100)}% do total` },
    { label: "Pendentes de limpeza", value: pendingCleaning, trend: "> 30 dias" },
    { label: "Pendentes de inspeção", value: pendingInspection, trend: "> 45 dias" },
    { label: "Calibração próxima", value: calibrationSoon, trend: "próximos 45 dias" }
  ];

  els.dashboardMetrics.innerHTML = metrics.map(item => `
    <article class="metric-card">
      <div class="metric-label">${item.label}</div>
      <div class="metric-value">${item.value}</div>
      <div class="metric-trend">${item.trend}</div>
    </article>
  `).join("");

  const alertItems = [
    {
      type: "warning",
      text: `${pendingCleaning} equipamentos com limpeza em atraso.`
    },
    {
      type: "warning",
      text: `${pendingInspection} inspeções pendentes na rotina.`
    },
    {
      type: "success",
      text: `${conforming} equipamentos estão operacionais no momento.`
    }
  ];

  els.alertList.innerHTML = alertItems.map(item => `
    <div class="alert-item">
      <span class="alert-dot ${item.type === "success" ? "success" : "warning"}"></span>
      <div>${item.text}</div>
    </div>
  `).join("");
}

function renderEquipmentList() {
  const filtered = getFilteredEquipment();
  if (!filtered.length) {
    els.equipmentList.innerHTML = '<div class="empty-state">Nenhum equipamento encontrado.</div>';
    return;
  }

  els.equipmentList.innerHTML = filtered.map(item => {
    const selected = item.id === state.selectedId ? "active" : "";
    return `
      <button class="equipment-item ${selected}" data-id="${item.id}">
        <strong>${item.name}</strong>
        <div class="item-meta">
          <span>${item.id}</span>
          <span class="badge ${statusClass(item.status)}">${item.status}</span>
        </div>
        <div class="item-meta">
          <span>${item.category}</span>
          <span>${item.location}</span>
        </div>
      </button>
    `;
  }).join("");

  document.querySelectorAll(".equipment-item").forEach(button => {
    button.addEventListener("click", event => {
      state.selectedId = event.currentTarget.dataset.id;
      state.currentTab = "records";
      render();
    });
  });
}

function renderTabContent(selected) {
  if (!selected) {
    els.tabContent.innerHTML = '<div class="empty-state">Selecione um equipamento.</div>';
    return;
  }

  if (state.currentTab === "records") {
    const records = [...selected.activities].sort((a, b) => new Date(b.date) - new Date(a.date));
    els.tabContent.innerHTML = records.length ? `
      <div class="record-list">
        ${records.map(record => `
          <article class="record-item">
            <div class="record-date">${formatDate(record.date)}</div>
            <div class="record-body">
              <strong>${record.type}</strong>
              <span>Responsável: ${record.responsible}</span>
              <p>${record.notes || "Nenhuma observação detalhada."}</p>
            </div>
            <span class="badge ${statusClass(record.status || selected.status)}">${record.status || selected.status}</span>
          </article>
        `).join("")}
      </div>
    ` : '<div class="empty-state">Ainda não há registros para este equipamento.</div>';
    return;
  }

  if (state.currentTab === "public") {
    const status = `
      <div class="public-status-card">
        <div class="public-header">
          <div>
            <p class="eyebrow">Status público</p>
            <h3>${selected.name}</h3>
          </div>
          <span class="badge ${statusClass(selected.status)}">${selected.status}</span>
        </div>
        <div class="public-meta">
          <div class="meta-box"><span>Última limpeza</span><strong>${formatDate(selected.lastCleaning)}</strong></div>
          <div class="meta-box"><span>Última verificação</span><strong>${formatDate(selected.lastInspection)}</strong></div>
          <div class="meta-box"><span>Próxima calibração</span><strong>${formatDate(selected.nextCalibration)}</strong></div>
          <div class="meta-box"><span>Responsável</span><strong>${selected.responsible}</strong></div>
        </div>
      </div>
    `;
    els.tabContent.innerHTML = status;
    return;
  }

  if (state.currentTab === "technical") {
    const entries = Object.entries(selected.technical || {});
    els.tabContent.innerHTML = `
      <div class="record-list">
        ${entries.map(([key, value]) => `
          <div class="record-item">
            <div class="record-date">${key}</div>
            <div class="record-body">
              <strong>${value}</strong>
            </div>
            <span class="badge success">Detalhe</span>
          </div>
        `).join("")}
      </div>
    `;
    return;
  }

  if (state.currentTab === "qr") {
    els.tabContent.innerHTML = `
      <div class="qr-box">
        <div class="qr-sample" aria-label="QR code do equipamento"></div>
        <div class="qr-code-label">${selected.qrCode}</div>
        <div>${selected.publicUrl}</div>
      </div>
    `;
  }
}

function renderEquipmentOverview(selected) {
  els.equipmentOverview.innerHTML = `
    <li><span>Categoria</span><strong>${selected.category}</strong></li>
    <li><span>Local</span><strong>${selected.location}</strong></li>
    <li><span>Fabricante</span><strong>${selected.manufacturer}</strong></li>
    <li><span>Nº Patrimonial</span><strong>${selected.assetNumber}</strong></li>
    <li><span>Nº Série</span><strong>${selected.serial}</strong></li>
    <li><span>Aquisição</span><strong>${selected.acquisitionYear}</strong></li>
    <li><span>Status</span><strong>${selected.status}</strong></li>
  `;

  els.equipmentActions.innerHTML = `
    <li><span>Última limpeza</span><strong>${formatDate(selected.lastCleaning)}</strong></li>
    <li><span>Última inspeção</span><strong>${formatDate(selected.lastInspection)}</strong></li>
    <li><span>Próxima calibração</span><strong>${formatDate(selected.nextCalibration)}</strong></li>
    <li><span>Responsável</span><strong>${selected.responsible}</strong></li>
  `;
}

function renderPublicStatus() {
  const selected = getSelectedEquipment();
  if (!selected) {
    els.publicStatusCard.innerHTML = '<div class="empty-state">Nenhum equipamento selecionado.</div>';
    return;
  }

  els.publicStatusCard.innerHTML = `
    <div class="public-header">
      <div>
        <p class="eyebrow">Consulta pública</p>
        <h3>${selected.name}</h3>
      </div>
      <span class="badge ${statusClass(selected.status)}">${selected.status}</span>
    </div>
    <div class="public-meta">
      <div class="meta-box"><span>Última limpeza</span><strong>${formatDate(selected.lastCleaning)}</strong></div>
      <div class="meta-box"><span>Última verificação</span><strong>${formatDate(selected.lastInspection)}</strong></div>
      <div class="meta-box"><span>Próxima calibração</span><strong>${formatDate(selected.nextCalibration)}</strong></div>
      <div class="meta-box"><span>Responsável</span><strong>${selected.responsible}</strong></div>
    </div>
  `;
}

function renderSelectedEquipment() {
  const selected = getSelectedEquipment();
  if (!selected) {
    els.equipmentName.textContent = "Selecione um item";
    return;
  }

  els.equipmentName.textContent = selected.name;
  renderTabContent(selected);
  renderEquipmentOverview(selected);
  renderPublicStatus();
}

function render() {
  renderDashboard();
  renderEquipmentList();
  renderSelectedEquipment();
  updateRoleVisibility();
  syncTabs();
}

function updateRoleVisibility() {
  const isConsulta = state.role === "consulta";
  els.activityBtn.style.display = isConsulta ? "none" : "inline-flex";
  els.newEquipmentBtn.style.display = isConsulta ? "none" : "inline-flex";
}

function syncTabs() {
  tabButtons.forEach(button => {
    const isActive = button.dataset.tab === state.currentTab;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function showView(viewName) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `${viewName}View`));
}

function openModal() {
  const selected = getSelectedEquipment();
  if (!selected) return;
  const today = new Date().toISOString().split("T")[0];
  document.querySelector("#activityDate").value = today;
  els.modalTitle.textContent = `Registrar atividade · ${selected.name}`;
  els.modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  els.activityForm.reset();
}

function openEquipmentModal() {
  els.newEquipmentModal.classList.remove("hidden");
}

function closeEquipmentModal() {
  els.newEquipmentModal.classList.add("hidden");
  els.equipmentForm.reset();
}

function addRecord(event) {
  event.preventDefault();
  const selected = getSelectedEquipment();
  if (!selected) return;

  const formData = new FormData(els.activityForm);
  const record = {
    id: crypto.randomUUID(),
    date: formData.get("date"),
    type: formData.get("type"),
    responsible: formData.get("responsible"),
    status: formData.get("status"),
    notes: formData.get("notes") || "Nenhuma observação.",
  };

  selected.activities.push(record);
  selected.lastCleaning = selected.lastCleaning || record.date;
  selected.lastInspection = selected.lastInspection || record.date;
  selected.status = record.status;

  if (record.type === "Limpeza") selected.lastCleaning = record.date;
  if (record.type === "Inspeção" || record.type === "Observação") selected.lastInspection = record.date;
  if (record.type === "Calibração") selected.lastCalibration = record.date;

  saveEquipment();
  closeModal();
  render();
}

function addEquipment(event) {
  event.preventDefault();
  const formData = new FormData(els.equipmentForm);
  const code = formData.get("code").toString().trim();
  const name = formData.get("name").toString().trim();
  const category = formData.get("category").toString().trim();
  const location = formData.get("location").toString().trim();
  const manufacturer = formData.get("manufacturer").toString().trim() || "A definir";
  const assetNumber = formData.get("asset").toString().trim() || "A definir";

  const newItem = {
    id: code,
    name,
    category,
    location,
    manufacturer,
    assetNumber,
    serial: `${code}-SN`,
    acquisitionYear: new Date().getFullYear(),
    status: "Operacional",
    responsible: "Equipe Operações",
    publicUrl: `https://labtrack.lnbio/equipamento/${code}`,
    qrCode: `QR-${code}`,
    lastCleaning: new Date().toISOString().split("T")[0],
    lastInspection: new Date().toISOString().split("T")[0],
    lastCalibration: new Date().toISOString().split("T")[0],
    nextCalibration: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    technical: {
      modelo: "A definir",
      capacidade: "A definir",
      resolucao: "A definir",
      peso: "A definir",
      localizacao: location,
      manual: "Abrir",
      pop: "Abrir"
    },
    activities: [{
      id: crypto.randomUUID(),
      date: new Date().toISOString().split("T")[0],
      type: "Inspeção",
      responsible: "Equipe Operações",
      status: "Operacional",
      notes: "Equipamento cadastrado no sistema de rastreabilidade."
    }]
  };

  state.equipment.unshift(newItem);
  state.selectedId = newItem.id;
  saveEquipment();
  closeEquipmentModal();
  render();
}

els.roleSelect.addEventListener("change", event => {
  state.role = event.target.value;
  render();
});

els.searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  renderEquipmentList();
});

els.activityBtn.addEventListener("click", openModal);
els.cancelActivityBtn.addEventListener("click", closeModal);
els.closeModalBtn.addEventListener("click", closeModal);
els.modalBackdrop.addEventListener("click", event => {
  if (event.target === els.modalBackdrop) closeModal();
});
els.activityForm.addEventListener("submit", addRecord);

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.currentTab = button.dataset.tab;
    render();
  });
});

els.newEquipmentBtn.addEventListener("click", openEquipmentModal);
els.closeNewEquipmentBtn.addEventListener("click", closeEquipmentModal);
els.cancelEquipmentBtn.addEventListener("click", closeEquipmentModal);
els.newEquipmentModal.addEventListener("click", event => {
  if (event.target === els.newEquipmentModal) closeEquipmentModal();
});
els.equipmentForm.addEventListener("submit", addEquipment);

document.addEventListener("DOMContentLoaded", () => {
  state.selectedId = state.equipment[0]?.id || null;
  showView("dashboard");
  render();
});

const navButtons = [
  { id: "dashboard", label: "Dashboard" },
  { id: "equipment", label: "Equipamentos" },
  { id: "public", label: "Consulta" }
];

navButtons.forEach(({ id }) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = id === "dashboard" ? "Dashboard" : id === "equipment" ? "Equipamentos" : "Consulta pública";
  button.className = "secondary-btn small";
  button.style.marginRight = "8px";
  button.addEventListener("click", () => {
    if (id === "dashboard") showView("dashboard");
    if (id === "equipment") showView("equipment");
    if (id === "public") showView("public");
  });
  const topbar = document.querySelector(".topbar");
  topbar.appendChild(button);
});

showView("dashboard");

window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeEquipmentModal();
  }
});
