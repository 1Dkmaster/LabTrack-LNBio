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

const inventoryCatalog = [
  { id: "LNB-BAL-001", name: "Balança Analítica AX223 - Ohaus", category: "Balança" },
  { id: "LNB-BAL-002", name: "Balança Analítica Pioneer - Ohaus", category: "Balança" },
  { id: "LNB-BAL-003", name: "Balança Analítica M214Ai - Bel", category: "Balança" },
  { id: "LNB-EQP-001", name: "Centrífuga 5810R - Eppendorf", category: "Centrífuga" },
  { id: "LNB-EQP-007", name: "Centrífuga MiniSpin C1008-P - Interprise", category: "Centrífuga" },
  { id: "LNB-EQP-033", name: "Centrífuga de placas Platefuge C2000- Benchmark", category: "Centrífuga" },
  { id: "LNB-EQP-053", name: "pHmetro Orion 720 - Thermo Scientific", category: "pHmetro" },
  { id: "LNB-EQP-067", name: "pHmetro Accumet AB15 - FisherBrand", category: "pHmetro" },
  { id: "LNB-EQP-147", name: "pHmetro Orion 420A+ - Thermo Scientific", category: "pHmetro" },
  { id: "LNB-VOX-001", name: "Agitador Vortex Standard - VWR", category: "Agitador vortex" },
  { id: "LNB-EQP-013", name: "Agitador magnético com aquecimento Isotemp - FisherBrand", category: "Agitador magnético" },
  { id: "LNB-AUT-001", name: "Autoclave vertical AV Plus - Phoenix Luferco", category: "Autoclave" },
  { id: "LNB-FRZ-001", name: "Freezer MDF-U333 - Sanyo", category: "Freezer" },
  { id: "LNB-MIC-001", name: "Microscópio Evos M5000 - Thermo Scientific", category: "Microscópio" },
  { id: "LNB-ESP-001", name: "Espectrofotômetro V-730 - Jasco", category: "Espectrofotômetro" },
  { id: "LNB-INC-001", name: "Incubadora CO2 3111 - Thermo Scientific", category: "Incubadora" },
  { id: "LNB-BOV-001", name: "Bomba de vácuo Diapump - Fanem", category: "Bomba de vácuo" },
  { id: "LNB-CSB-001", name: "Cabine de segurança biológica Biosafe A1 - Veco", category: "Cabine de segurança biológica" }
];

function createInventoryEquipment(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    location: "Não informada na planilha",
    manufacturer: "Não informado separadamente na planilha",
    assetNumber: "Não informado",
    serial: "Não informado",
    acquisitionYear: "Não informado",
    status: "Não verificado",
    responsible: "Não informado",
    publicUrl: "",
    qrCode: `QR-${item.id}`,
    lastCleaning: "",
    lastInspection: "",
    lastCalibration: "",
    nextCalibration: "",
    inventorySource: "Inventario_Tags_LNBIO_V3.xlsx",
    technical: {
      modelo: "Consultar nome/modelo do inventário",
      documentacao: "Não cadastrada"
    },
    activities: []
  };
}

let state = {
  equipment: loadEquipment(),
  selectedId: null,
  currentTab: "overview",
};

const els = {
  equipmentSelect: document.querySelector("#equipmentSelect"),
  equipmentSuggestions: document.querySelector("#equipmentSuggestions"),
  identifyEquipmentForm: document.querySelector("#identifyEquipmentForm"),
  tagInput: document.querySelector("#tagInput"),
  identifyMessage: document.querySelector("#identifyMessage"),
  dashboardMetrics: document.querySelector("#dashboardMetrics"),
  alertList: document.querySelector("#alertList"),
  equipmentName: document.querySelector("#equipmentName"),
  equipmentTagline: document.querySelector("#equipmentTagline"),
  tabContent: document.querySelector("#tabContent"),
  publicStatusCard: document.querySelector("#publicStatusCard"),
  activityBtn: document.querySelector("#activityBtn"),
  copyEquipmentLinkBtn: document.querySelector("#copyEquipmentLinkBtn"),
  modalBackdrop: document.querySelector("#modalBackdrop"),
  activityForm: document.querySelector("#activityForm"),
  checklistItems: document.querySelector("#checklistItems"),
  addChecklistItemBtn: document.querySelector("#addChecklistItemBtn"),
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
const navButtons = [...document.querySelectorAll(".nav-btn")];

function loadEquipment() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : defaultEquipment;
    const equipment = Array.isArray(parsed) && parsed.length ? parsed : [...defaultEquipment];
    const existingIds = new Set(equipment.map(item => item.id));
    const newInventoryItems = inventoryCatalog
      .filter(item => !existingIds.has(item.id))
      .map(createInventoryEquipment);

    if (!saved || newInventoryItems.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...equipment, ...newInventoryItems]));
    }

    return [...equipment, ...newInventoryItems];
  } catch (error) {
    console.error("Não foi possível carregar ou atualizar o inventário salvo neste navegador.", error);
    window.alert("Não foi possível atualizar o inventário salvo. Confira as permissões e o espaço disponível neste navegador.");
    return [...defaultEquipment, ...inventoryCatalog.map(createInventoryEquipment)];
  }
}

function saveEquipment() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.equipment));
    return true;
  } catch (error) {
    console.error("Não foi possível salvar os dados do LabTrack neste navegador.", error);
    window.alert("Não foi possível salvar os dados neste navegador. Verifique o espaço disponível e tente novamente.");
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function statusClass(status) {
  if (status === "Operacional") return "success";
  if (status === "Atenção") return "warning";
  if (status === "Não verificado") return "neutral";
  return "danger";
}

function getSelectedEquipment() {
  return state.equipment.find(item => item.id === state.selectedId) || null;
}

function renderIdentification() {
  els.equipmentSuggestions.innerHTML = state.equipment
    .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
    .join("");
  const categories = [...new Set(state.equipment.map(item => item.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  els.equipmentSelect.innerHTML = `
    <option value="">Escolher equipamento...</option>
    ${categories.map(category => `
      <optgroup label="${escapeHtml(category)}">
        ${state.equipment.filter(item => item.category === category).map(item => `
          <option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.name)}</option>
        `).join("")}
      </optgroup>
    `).join("")}
  `;
}

function renderDashboard() {
  const total = state.equipment.length;
  const conforming = state.equipment.filter(item => item.status === "Operacional").length;
  const unverified = state.equipment.filter(item => item.status === "Não verificado").length;
  const daysSince = value => {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    return (new Date() - date) / (1000 * 60 * 60 * 24);
  };
  const pendingCleaning = state.equipment.filter(item => {
    const days = daysSince(item.lastCleaning);
    return days !== null && days > 30;
  }).length;
  const pendingInspection = state.equipment.filter(item => {
    const days = daysSince(item.lastInspection);
    return days !== null && days > 45;
  }).length;
  const calibrationSoon = state.equipment.filter(item => {
    if (!item.nextCalibration) return false;
    const nextCalibration = new Date(`${item.nextCalibration}T00:00:00`);
    if (Number.isNaN(nextCalibration.getTime())) return false;
    const diff = (nextCalibration - new Date()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 45;
  }).length;

  const metrics = [
    { label: "Equipamentos cadastrados", value: total, trend: "Base do inventário" },
    { label: "Status operacional", value: conforming, trend: "Registros classificados como operacional" },
    { label: "Sem verificação", value: unverified, trend: "Sem status técnico confirmado" },
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

function renderTabContent(selected) {
  if (!selected) {
    els.tabContent.innerHTML = '<div class="empty-state">Selecione um equipamento.</div>';
    return;
  }

  if (state.currentTab === "overview") {
    els.tabContent.innerHTML = `
      <div class="equipment-overview-grid">
        <article class="overview-item"><span>TAG</span><strong>${escapeHtml(selected.id)}</strong></article>
        <article class="overview-item"><span>Categoria</span><strong>${escapeHtml(selected.category)}</strong></article>
        <article class="overview-item"><span>Localização</span><strong>${escapeHtml(selected.location || "Não informada")}</strong></article>
        <article class="overview-item"><span>Situação registrada</span><strong>${escapeHtml(selected.status || "Não verificado")}</strong></article>
      </div>
      ${selected.inventorySource ? `<p class="source-note">Identificação importada da planilha de inventário. Localização, status e histórico ainda precisam ser confirmados.</p>` : ""}
      <button type="button" class="primary-btn overview-action" id="startEquipmentActivityBtn">Registrar uma atividade</button>
    `;
    els.tabContent.querySelector("#startEquipmentActivityBtn").addEventListener("click", openModal);
    return;
  }

  if (state.currentTab === "records") {
    const records = [...(selected.activities || [])].sort((a, b) =>
      new Date(getRecordTimestamp(b)) - new Date(getRecordTimestamp(a))
    );
    els.tabContent.innerHTML = `
      <div class="history-toolbar">
        <p>Relatórios e exportação referentes a <strong>${escapeHtml(selected.id)}</strong>.</p>
        <button type="button" class="secondary-btn small" id="exportEquipmentCsvBtn">Exportar planilha CSV</button>
      </div>
      ${records.length ? `
      <div class="record-list">
        ${records.map(record => `
          <article class="record-item">
            <div class="record-date">${escapeHtml(formatRecordDateTime(record))}</div>
            <div class="record-body">
              <strong>${escapeHtml(record.type)}</strong>
              <span>Realizado por: ${escapeHtml(record.responsible)}</span>
              <span>Situação registrada: ${escapeHtml(record.status || selected.status || "—")}</span>
              ${record.checklist?.length ? `<ul class="record-checklist">${record.checklist.map(item => `
                <li>${escapeHtml(item.description)} — ${escapeHtml(item.result)}</li>
              `).join("")}</ul>` : ""}
              <p>${escapeHtml(record.notes || "Sem observações adicionais.")}</p>
              <button type="button" class="secondary-btn small report-btn" data-record-id="${escapeHtml(record.id)}">Abrir relatório</button>
            </div>
            <span class="badge ${statusClass(record.status || selected.status)}">${escapeHtml(record.status || selected.status || "—")}</span>
          </article>
        `).join("")}
      </div>
      ` : '<div class="empty-state">Ainda não há atividades registradas para este equipamento.</div>'}
    `;
    els.tabContent.querySelector("#exportEquipmentCsvBtn")?.addEventListener("click", exportEquipmentCsv);
    els.tabContent.querySelectorAll(".report-btn").forEach(button => {
      button.addEventListener("click", () => openActivityReport(selected, button.dataset.recordId));
    });
    return;
  }

  if (state.currentTab === "public") {
    const status = `
      <div class="public-status-card">
        <div class="public-header">
          <div>
            <p class="eyebrow">Status público</p>
            <h3>${escapeHtml(selected.name)}</h3>
          </div>
          <span class="badge ${statusClass(selected.status)}">${escapeHtml(selected.status)}</span>
        </div>
        <div class="public-meta">
          <div class="meta-box"><span>Última limpeza</span><strong>${formatDate(selected.lastCleaning)}</strong></div>
          <div class="meta-box"><span>Última verificação</span><strong>${formatDate(selected.lastInspection)}</strong></div>
          <div class="meta-box"><span>Próxima calibração</span><strong>${formatDate(selected.nextCalibration)}</strong></div>
          <div class="meta-box"><span>Responsável</span><strong>${escapeHtml(selected.responsible)}</strong></div>
        </div>
      </div>
    `;
    els.tabContent.innerHTML = status;
    return;
  }

  if (state.currentTab === "technical") {
    const entries = [
      ["Fabricante", selected.manufacturer],
      ["Modelo / identificação", selected.technical?.modelo || "Não informado"],
      ["Número de série", selected.serial],
      ["Número patrimonial", selected.assetNumber],
      ["Ano de aquisição", selected.acquisitionYear],
      ["Localização", selected.location],
      ["Última calibração", formatDate(selected.lastCalibration)],
      ["Próxima calibração", formatDate(selected.nextCalibration)],
      ...Object.entries(selected.technical || {}).filter(([key]) => key !== "modelo")
    ];
    const uniqueEntries = [...new Map(entries).entries()];
    els.tabContent.innerHTML = `
      <div class="technical-grid">
        ${uniqueEntries.map(([key, value]) => `
          <div class="technical-item">
            <span>${escapeHtml(key)}</span>
            <strong>${escapeHtml(value || "Não informado")}</strong>
          </div>
        `).join("")}
      </div>
      ${selected.inventorySource ? `<p class="source-note">Fonte da identificação: ${escapeHtml(selected.inventorySource)}. A planilha não fornece os demais campos acima.</p>` : ""}
    `;
    return;
  }

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
        <h3>${escapeHtml(selected.name)}</h3>
      </div>
      <span class="badge ${statusClass(selected.status)}">${escapeHtml(selected.status)}</span>
    </div>
    <div class="public-meta">
      <div class="meta-box"><span>Última limpeza</span><strong>${formatDate(selected.lastCleaning)}</strong></div>
      <div class="meta-box"><span>Última verificação</span><strong>${formatDate(selected.lastInspection)}</strong></div>
      <div class="meta-box"><span>Próxima calibração</span><strong>${formatDate(selected.nextCalibration)}</strong></div>
      <div class="meta-box"><span>Responsável</span><strong>${escapeHtml(selected.responsible)}</strong></div>
    </div>
  `;
}

function renderSelectedEquipment() {
  const selected = getSelectedEquipment();
  if (!selected) {
    els.equipmentName.textContent = "Selecione um item";
    els.equipmentTagline.textContent = "";
    renderTabContent(null);
    renderPublicStatus();
    return;
  }

  els.equipmentName.textContent = selected.name;
  els.equipmentTagline.textContent = `${selected.id} · ${selected.category} · ${selected.location || "Local não informado"}`;
  renderTabContent(selected);
  renderPublicStatus();
}

function render() {
  renderDashboard();
  renderIdentification();
  renderSelectedEquipment();
  syncTabs();
}

function escapeCsv(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportEquipmentCsv() {
  const selected = getSelectedEquipment();
  if (!selected) return;
  const rows = [["TAG", "Equipamento", "Data e hora", "Atividade", "Responsável informado", "Situação", "Item do checklist", "Resultado", "Observações"]];
  for (const record of selected.activities || []) {
    const checklist = record.checklist?.length ? record.checklist : [{ description: "", result: "" }];
    for (const item of checklist) {
      rows.push([
        selected.id,
        selected.name,
        formatRecordDateTime(record),
        record.type,
        record.responsible,
        record.status,
        item.description,
        item.result,
        record.notes
      ]);
    }
  }
  const csv = `\uFEFF${rows.map(row => row.map(escapeCsv).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `labtrack-${selected.id}-historico.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openActivityReport(equipment, recordId) {
  const record = (equipment.activities || []).find(item => item.id === recordId);
  if (!record) {
    window.alert("Não foi possível localizar este registro para gerar o relatório.");
    return;
  }
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    window.alert("O navegador bloqueou a janela do relatório. Permita pop-ups para gerar ou imprimir o relatório.");
    return;
  }

  const checklistRows = record.checklist?.length ? record.checklist.map(item => `
    <tr><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.result)}</td></tr>
  `).join("") : '<tr><td colspan="2">Nenhum item de checklist registrado.</td></tr>';
  reportWindow.document.write(`<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Relatório ${escapeHtml(equipment.id)} · LabTrack</title>
        <style>
          body{font:16px Arial,sans-serif;max-width:850px;margin:32px auto;padding:0 20px;color:#1b2430}
          h1{font-size:24px}h2{font-size:18px;margin-top:28px}
          table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border:1px solid #dfe8f8}
          th{background:#eef4ff}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .meta p{margin:4px 0}.notice{margin-top:32px;padding:12px;background:#fff7e8;border:1px solid #e8c879}
          .print-button{padding:10px 18px;background:#184f9a;color:#fff;border:0;border-radius:8px;cursor:pointer}
          @media print{body{margin:0}.print-button{display:none}}
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">Imprimir / salvar como PDF</button>
        <h1>Relatório de atividade · LabTrack LNBio</h1>
        <div class="meta">
          <p><strong>Equipamento:</strong> ${escapeHtml(equipment.name)}</p>
          <p><strong>TAG:</strong> ${escapeHtml(equipment.id)}</p>
          <p><strong>Atividade:</strong> ${escapeHtml(record.type)}</p>
          <p><strong>Data e hora:</strong> ${escapeHtml(formatRecordDateTime(record))}</p>
          <p><strong>Responsável informado:</strong> ${escapeHtml(record.responsible)}</p>
          <p><strong>Situação registrada:</strong> ${escapeHtml(record.status || "—")}</p>
        </div>
        <h2>Checklist do que foi realizado</h2>
        <table><thead><tr><th>Ação registrada</th><th>Resultado</th></tr></thead><tbody>${checklistRows}</tbody></table>
        <h2>Observações e resultados</h2>
        <p>${escapeHtml(record.notes || "Sem observações adicionais.")}</p>
        <p class="notice">Relatório gerado pelo protótipo LabTrack. O nome do responsável é informado no formulário e não constitui autenticação ou assinatura. Este documento não representa aprovação técnica.</p>
      </body>
    </html>`);
  reportWindow.document.close();
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

function formatDateTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getRecordTimestamp(record) {
  return record.createdAt || record.date || "";
}

function formatRecordDateTime(record) {
  if (record.createdAt) return formatDateTime(record.createdAt);
  if (record.date) return `${formatDate(record.date)} · horário não registrado`;
  return "Data e horário não registrados";
}

function showView(viewName) {
  document.body.dataset.view = viewName;
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === `${viewName}View`));
  navButtons.forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewName);
    button.setAttribute("aria-current", button.dataset.view === viewName ? "page" : "false");
  });
}

function selectEquipment(id) {
  const selected = state.equipment.find(item => item.id.toLowerCase() === id.trim().toLowerCase());
  if (!selected) {
    els.identifyMessage.textContent = `Não encontramos a TAG "${id.trim()}". Confira o código ou selecione um equipamento da lista.`;
    els.tagInput.focus();
    return;
  }
  state.selectedId = selected.id;
  state.currentTab = "overview";
  els.equipmentSelect.value = selected.id;
  els.identifyMessage.textContent = "";
  showView("equipment");
  render();
}

function openModal() {
  const selected = getSelectedEquipment();
  if (!selected) return;
  els.activityForm.reset();
  els.checklistItems.replaceChildren();
  addChecklistItem();
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
  const checklist = [...els.checklistItems.querySelectorAll(".checklist-row")].map(row => ({
    description: row.querySelector('[name="checklistDescription"]').value.trim(),
    result: row.querySelector('[name="checklistResult"]').value
  }));
  if (!checklist.length || checklist.some(item => !item.description)) {
    window.alert("Preencha a descrição de cada item do checklist ou remova os itens vazios.");
    return;
  }
  const now = new Date();
  const createdAt = now.toISOString();
  const localDate = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
  const record = {
    id: crypto.randomUUID(),
    date: localDate,
    createdAt,
    type: formData.get("type"),
    responsible: formData.get("responsible").toString().trim(),
    status: formData.get("status"),
    checklist,
    notes: formData.get("notes").toString().trim()
  };

  const previousStatus = selected.status;
  const previousCleaning = selected.lastCleaning;
  const previousInspection = selected.lastInspection;
  const previousCalibration = selected.lastCalibration;
  selected.activities.push(record);
  selected.status = record.status;

  if (record.type === "Limpeza") selected.lastCleaning = record.date;
  if (record.type === "Inspeção" || record.type === "Verificação" || record.type === "Observação") {
    selected.lastInspection = record.date;
  }
  if (record.type === "Calibração" || record.type === "Calibração diária") selected.lastCalibration = record.date;

  if (!saveEquipment()) {
    selected.activities.pop();
    selected.status = previousStatus;
    selected.lastCleaning = previousCleaning;
    selected.lastInspection = previousInspection;
    selected.lastCalibration = previousCalibration;
    return;
  }
  state.currentTab = "records";
  closeModal();
  render();
}

function addChecklistItem() {
  const row = document.createElement("div");
  row.className = "checklist-row";
  row.innerHTML = `
    <label>
      Ação executada
      <input name="checklistDescription" type="text" maxlength="240" placeholder="Descreva o que foi feito" required />
    </label>
    <label>
      Resultado
      <select name="checklistResult">
        <option value="Realizado">Realizado</option>
        <option value="Não realizado">Não realizado</option>
        <option value="Não se aplica">Não se aplica</option>
      </select>
    </label>
    <button type="button" class="icon-btn remove-checklist-btn" aria-label="Remover item do checklist">×</button>
  `;
  row.querySelector(".remove-checklist-btn").addEventListener("click", () => row.remove());
  els.checklistItems.append(row);
}

function addEquipment(event) {
  event.preventDefault();
  const formData = new FormData(els.equipmentForm);
  const code = formData.get("code").toString().trim().toUpperCase();
  const name = formData.get("name").toString().trim();
  const category = formData.get("category").toString().trim();
  const location = formData.get("location").toString().trim();
  const manufacturer = formData.get("manufacturer").toString().trim() || "Não informado";
  const assetNumber = formData.get("asset").toString().trim() || "Não informado";
  if (state.equipment.some(item => item.id.toLowerCase() === code.toLowerCase())) {
    window.alert(`A TAG "${code}" já está cadastrada.`);
    return;
  }

  const newItem = {
    id: code,
    name,
    category,
    location,
    manufacturer,
    assetNumber,
    serial: "Não informado",
    acquisitionYear: "Não informado",
    status: "Não verificado",
    responsible: "Não informado",
    publicUrl: "",
    qrCode: `QR-${code}`,
    lastCleaning: "",
    lastInspection: "",
    lastCalibration: "",
    nextCalibration: "",
    technical: {
      modelo: "Não informado",
      localizacao: location,
      documentacao: "Não cadastrada"
    },
    activities: []
  };

  state.equipment.unshift(newItem);
  state.selectedId = newItem.id;
  if (!saveEquipment()) {
    state.equipment.shift();
    return;
  }
  closeEquipmentModal();
  render();
  showView("equipment");
}

els.activityBtn.addEventListener("click", openModal);
els.copyEquipmentLinkBtn.addEventListener("click", async () => {
  const selected = getSelectedEquipment();
  if (!selected) return;
  const link = new URL(window.location.href);
  link.searchParams.set("tag", selected.id);
  try {
    await navigator.clipboard.writeText(link.toString());
    window.alert("Link de identificação copiado. Associe-o ao QR físico para abrir este equipamento.");
  } catch (error) {
    console.error("Não foi possível copiar o link de identificação.", error);
    window.alert(`Não foi possível copiar automaticamente. Link para o QR: ${link.toString()}`);
  }
});
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
els.addChecklistItemBtn.addEventListener("click", addChecklistItem);
els.identifyEquipmentForm.addEventListener("submit", event => {
  event.preventDefault();
  selectEquipment(els.tagInput.value);
});
els.equipmentSelect.addEventListener("change", event => {
  if (event.target.value) selectEquipment(event.target.value);
});
document.querySelector("#identifyQrBtn").addEventListener("click", () => {
  els.identifyMessage.textContent = "";
  els.tagInput.value = "";
  showView("identify");
  els.tagInput.focus();
});
navButtons.forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));

document.addEventListener("DOMContentLoaded", () => {
  render();
  const tag = new URLSearchParams(window.location.search).get("tag");
  if (tag) {
    els.tagInput.value = tag;
    selectEquipment(tag);
  } else {
    showView("home");
  }
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeEquipmentModal();
  }
});
