let state = {
  equipment: [],
  selectedId: null,
  currentTab: "overview",
  currentUser: null,
  authEnabled: true,
  revisingActivityId: null,
  reviewRequest: null,
};

const els = {
  loginView: document.querySelector("#loginView"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginMessage: document.querySelector("#loginMessage"),
  setupForm: document.querySelector("#setupForm"),
  setupMessage: document.querySelector("#setupMessage"),
  currentUserLabel: document.querySelector("#currentUserLabel"),
  logoutBtn: document.querySelector("#logoutBtn"),
  accessTab: document.querySelector("#accessTab"),
  refreshUsersBtn: document.querySelector("#refreshUsersBtn"),
  auditBtn: document.querySelector("#auditBtn"),
  auditModal: document.querySelector("#auditModal"),
  auditList: document.querySelector("#auditList"),
  closeAuditBtn: document.querySelector("#closeAuditBtn"),
  userForm: document.querySelector("#userForm"),
  userEquipmentAccess: document.querySelector("#userEquipmentAccess"),
  userList: document.querySelector("#userList"),
  reviewModal: document.querySelector("#reviewModal"),
  reviewForm: document.querySelector("#reviewForm"),
  reviewModalTitle: document.querySelector("#reviewModalTitle"),
  reviewModalHint: document.querySelector("#reviewModalHint"),
  reviewerNameField: document.querySelector("#reviewerNameField"),
  reviewerName: document.querySelector("#reviewerName"),
  reviewComments: document.querySelector("#reviewComments"),
  closeReviewModalBtn: document.querySelector("#closeReviewModalBtn"),
  cancelReviewBtn: document.querySelector("#cancelReviewBtn"),
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

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    },
    cache: "no-store"
  });
  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    console.error("O servidor retornou uma resposta que não pôde ser lida.", error);
    throw new Error("Não foi possível interpretar a resposta do servidor.");
  }
  if (!response.ok) {
    if (response.status === 401 && path !== "/api/login" && state.currentUser) {
      showLogin("Sua sessão expirou. Entre novamente.");
    }
    throw new Error(payload.error || `Falha na solicitação (${response.status}).`);
  }
  return payload;
}

function showLogin(message = "") {
  state.currentUser = null;
  state.equipment = [];
  els.loginView.classList.remove("hidden");
  els.appShell.classList.add("hidden");
  els.loginForm.classList.remove("hidden");
  els.setupForm.classList.add("hidden");
  els.loginMessage.textContent = message;
}

async function enterApplication(user) {
  state.currentUser = user;
  state.equipment = (await apiRequest("/api/equipment")).equipment;
  els.loginView.classList.add("hidden");
  els.appShell.classList.remove("hidden");
  els.currentUserLabel.textContent = user.authenticated
    ? `${user.name} · ${user.roleName}`
    : "Acesso sem autenticação · nomes declarados";
  els.logoutBtn.classList.toggle("hidden", !user.authenticated);
  els.accessTab.classList.toggle("hidden", !user.authenticated || user.role !== "admin");
  els.auditBtn.classList.toggle("hidden", !user.authenticated || user.role !== "admin");
  els.newEquipmentBtn.classList.toggle("hidden", user.role !== "admin");
  els.activityBtn.classList.toggle("hidden", user.role === "viewer");
  render();
}

function openEquipmentFromUrl() {
  const tag = new URLSearchParams(window.location.search).get("tag");
  if (tag) {
    els.tagInput.value = tag;
    selectEquipment(tag);
  } else {
    showView("home");
  }
}

async function initialize() {
  try {
    const health = await apiRequest("/api/health");
    state.authEnabled = health.authEnabled;
    if (health.authEnabled && health.setupRequired) {
      els.loginView.classList.remove("hidden");
      els.appShell.classList.add("hidden");
      els.loginForm.classList.add("hidden");
      els.setupForm.classList.remove("hidden");
      return;
    }
    const session = await apiRequest("/api/session");
    if (!session.user) {
      showLogin();
      return;
    }
    await enterApplication(session.user);
    openEquipmentFromUrl();
  } catch (error) {
    if (error.message !== "Entre para continuar.") {
      els.loginMessage.textContent = error.message;
    }
    showLogin(els.loginMessage.textContent);
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
  const pendingActivities = state.equipment.reduce(
    (total, item) => total + (item.activities || []).filter(record =>
      ["pending", "changes_requested"].includes(record.reviewStatus)
    ).length,
    0
  );
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
    { label: "Atividades para revisar", value: pendingActivities, trend: "Aguardando decisão técnica" },
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
    const canSubmit = state.currentUser?.role !== "viewer";
    els.tabContent.innerHTML = `
      <div class="equipment-overview-grid">
        <article class="overview-item"><span>TAG</span><strong>${escapeHtml(selected.id)}</strong></article>
        <article class="overview-item"><span>Categoria</span><strong>${escapeHtml(selected.category)}</strong></article>
        <article class="overview-item"><span>Localização</span><strong>${escapeHtml(selected.location || "Não informada")}</strong></article>
        <article class="overview-item"><span>Situação registrada</span><strong>${escapeHtml(selected.status || "Não verificado")}</strong></article>
      </div>
      ${selected.inventorySource ? `<p class="source-note">Identificação importada da planilha de inventário. Dados não fornecidos por ela permanecem como não informados.</p>` : ""}
      ${canSubmit ? '<button type="button" class="primary-btn overview-action" id="startEquipmentActivityBtn">Registrar uma atividade</button>' : '<p class="form-help">Perfil espectador: acesso somente para consulta.</p>'}
    `;
    els.tabContent.querySelector("#startEquipmentActivityBtn")?.addEventListener("click", () => openModal());
    return;
  }

  if (state.currentTab === "records") {
    const records = [...(selected.activities || [])].sort((a, b) =>
      new Date(getRecordTimestamp(b)) - new Date(getRecordTimestamp(a))
    );
    const canReview = !state.currentUser?.authenticated
      || state.currentUser?.role === "admin";
    const canSubmit = state.currentUser?.role !== "viewer";
    const canEditRecords = state.currentUser?.role === "admin";
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
              <span>Realizado por: ${escapeHtml(record.responsible)} · ${record.actorAuthenticated ? "identidade autenticada" : "nome declarado, não autenticado"}</span>
              <span>Situação registrada: ${escapeHtml(record.status || selected.status || "—")}</span>
              <span>Revisão: ${escapeHtml(recordReviewStatusLabel(record))}</span>
              ${record.checklist?.length ? `<ul class="record-checklist">${record.checklist.map(item => `
                <li>${escapeHtml(item.description)} — ${escapeHtml(item.result)}</li>
              `).join("")}</ul>` : ""}
              ${record.revisionNumber ? `<span>Versão corrigida: ${record.revisionNumber}</span>` : ""}
              <p>${escapeHtml(record.notes || "Sem observações adicionais.")}</p>
              ${record.reviews?.map(review => `<p class="review-note">${escapeHtml(reviewStatusLabel(review.decision))} por ${escapeHtml(review.reviewer.name)}${review.reviewer.authenticated ? "" : " (nome declarado, não autenticado)"} · ${escapeHtml(formatRecordDateTime({ createdAt: review.createdAt }))}${review.comments ? ` · ${escapeHtml(review.comments)}` : ""}</p>`).join("") || ""}
              ${canSubmit && record.reviewStatus === "changes_requested" && (!state.currentUser?.authenticated || record.actor?.id === state.currentUser?.id) ? `
                <button type="button" class="secondary-btn small correction-btn" data-record-id="${escapeHtml(record.id)}">Enviar correção solicitada</button>
              ` : ""}
              ${canReview && (!state.currentUser?.authenticated || record.actor?.id !== state.currentUser?.id) && record.reviewStatus === "pending" ? `
                <div class="review-actions">
                  <button type="button" class="primary-btn small review-btn" data-record-id="${escapeHtml(record.id)}" data-decision="approved">Aprovar</button>
                  <button type="button" class="secondary-btn small review-btn" data-record-id="${escapeHtml(record.id)}" data-decision="changes_requested">Solicitar correção</button>
                  <button type="button" class="secondary-btn small review-btn" data-record-id="${escapeHtml(record.id)}" data-decision="rejected">Reprovar</button>
                </div>
              ` : ""}
              ${canEditRecords ? `<button type="button" class="secondary-btn small admin-edit-btn" data-record-id="${escapeHtml(record.id)}">Editar como Administrador Máximo</button>` : ""}
              <button type="button" class="secondary-btn small report-btn" data-record-id="${escapeHtml(record.id)}">Abrir relatório</button>
            </div>
            <span class="badge ${reviewStatusClass(record.reviewStatus)}">${escapeHtml(recordReviewStatusLabel(record))}</span>
          </article>
        `).join("")}
      </div>
      ` : '<div class="empty-state">Ainda não há atividades registradas para este equipamento.</div>'}
    `;
    els.tabContent.querySelector("#exportEquipmentCsvBtn")?.addEventListener("click", exportEquipmentCsv);
    els.tabContent.querySelectorAll(".report-btn").forEach(button => {
      button.addEventListener("click", () => openActivityReport(selected, button.dataset.recordId));
    });
    els.tabContent.querySelectorAll(".review-btn").forEach(button => {
      button.addEventListener("click", () => reviewActivity(button.dataset.recordId, button.dataset.decision));
    });
    els.tabContent.querySelectorAll(".correction-btn").forEach(button => {
      button.addEventListener("click", () => {
        const record = records.find(item => item.id === button.dataset.recordId);
        if (record) openModal(record);
      });
    });
    els.tabContent.querySelectorAll(".admin-edit-btn").forEach(button => {
      button.addEventListener("click", () => {
        const record = records.find(item => item.id === button.dataset.recordId);
        if (record) openModal(record);
      });
    });
    return;
  }

  if (state.currentTab === "public") {
    const status = `
      <div class="public-status-card">
        <div class="public-header">
          <div>
            <p class="eyebrow">Status do equipamento</p>
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

function reviewStatusLabel(status) {
  return ({
    pending: "Pendente de revisão",
    approved: "Aprovado",
    rejected: "Reprovado",
    changes_requested: "Correção solicitada"
  })[status] || "Não informado";
}

function recordReviewStatusLabel(record) {
  const latestReview = record.reviews?.[record.reviews.length - 1];
  const label = reviewStatusLabel(record.reviewStatus);
  return latestReview && !latestReview.reviewer.authenticated
    ? `${label} · decisão não autenticada`
    : label;
}

function reviewStatusClass(status) {
  return ({
    pending: "warning",
    approved: "success",
    rejected: "danger",
    changes_requested: "warning"
  })[status] || "neutral";
}

function reviewActivity(activityId, decision) {
  state.reviewRequest = { activityId, decision };
  const labels = {
    approved: [
      "Aprovar atividade",
      state.currentUser?.authenticated
        ? "O comentário é opcional. A aprovação atualizará a situação oficial do equipamento."
        : "O comentário é opcional. Esta decisão ficará identificada como não autenticada e não alterará a situação oficial do equipamento."
    ],
    rejected: ["Reprovar atividade", "Descreva o motivo da reprovação."],
    changes_requested: ["Solicitar correção", "Descreva a correção necessária para o responsável pelo registro."]
  };
  [els.reviewModalTitle.textContent, els.reviewModalHint.textContent] = labels[decision];
  els.reviewComments.required = decision !== "approved";
  els.reviewerNameField.classList.toggle("hidden", state.currentUser?.authenticated);
  els.reviewerName.required = !state.currentUser?.authenticated;
  els.reviewForm.reset();
  els.reviewModal.classList.remove("hidden");
  (state.currentUser?.authenticated ? els.reviewComments : els.reviewerName).focus();
}

function closeReviewModal() {
  els.reviewModal.classList.add("hidden");
  els.reviewForm.reset();
  state.reviewRequest = null;
}

async function submitReview(event) {
  event.preventDefault();
  if (!state.reviewRequest) return;
  const { activityId, decision } = state.reviewRequest;
  const comments = els.reviewComments.value.trim();
  const reviewerName = els.reviewerName.value.trim();
  try {
    await apiRequest(`/api/activities/${encodeURIComponent(activityId)}/review`, {
      method: "POST",
      body: JSON.stringify({ decision, comments, reviewerName })
    });
    state.equipment = (await apiRequest("/api/equipment")).equipment;
    closeReviewModal();
    render();
  } catch (error) {
    window.alert(`Não foi possível registrar a decisão: ${error.message}`);
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
        <p class="eyebrow">Status do equipamento</p>
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
  const rows = [["TAG", "Equipamento", "Data e hora", "Atividade", "Responsável", "Identidade autenticada", "Situação registrada", "Revisão", "Revisor", "Identidade do revisor autenticada", "Data da revisão", "Comentário da revisão", "Item do checklist", "Resultado", "Observações"]];
  for (const record of selected.activities || []) {
    const checklist = record.checklist?.length ? record.checklist : [{ description: "", result: "" }];
    const latestReview = record.reviews?.[record.reviews.length - 1];
    for (const item of checklist) {
      rows.push([
        selected.id,
        selected.name,
        formatRecordDateTime(record),
        record.type,
        record.responsible,
        record.actorAuthenticated ? "Sim" : "Não",
        record.status,
        recordReviewStatusLabel(record),
        latestReview?.reviewer?.name || "",
        latestReview?.reviewer?.authenticated ? "Sim" : "Não",
        latestReview ? formatRecordDateTime({ createdAt: latestReview.createdAt }) : "",
        latestReview?.comments || "",
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
          <p><strong>Responsável ${record.actorAuthenticated ? "(autenticado)" : "(nome declarado, não autenticado)"}:</strong> ${escapeHtml(record.responsible)}</p>
          <p><strong>Situação registrada:</strong> ${escapeHtml(record.status || "—")}</p>
        </div>
        <h2>Checklist do que foi realizado</h2>
        <table><thead><tr><th>Ação registrada</th><th>Resultado</th></tr></thead><tbody>${checklistRows}</tbody></table>
        <h2>Observações e resultados</h2>
        <p>${escapeHtml(record.notes || "Sem observações adicionais.")}</p>
        <h2>Revisões</h2>
        ${record.reviews?.length ? `<ul>${record.reviews.map(review => `<li>${escapeHtml(reviewStatusLabel(review.decision))} por ${escapeHtml(review.reviewer.name)}${review.reviewer.authenticated ? "" : " (nome declarado, não autenticado)"} em ${escapeHtml(formatRecordDateTime({ createdAt: review.createdAt }))}${review.comments ? `: ${escapeHtml(review.comments)}` : ""}</li>`).join("")}</ul>` : "<p>Registro pendente de revisão.</p>"}
        <p class="notice">Este relatório reflete registros armazenados no servidor. ${record.actorAuthenticated ? "A revisão técnica não substitui critérios metrológicos aprovados nem assinatura eletrônica institucional." : "Nomes e decisões estão não autenticados; decisões neste modo não alteram a situação oficial do equipamento."}</p>
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
  if (viewName === "access" && state.currentUser?.role !== "admin") {
    viewName = "home";
  }
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

function openModal(revisionRecord = null) {
  const selected = getSelectedEquipment();
  if (!selected || state.currentUser?.role === "viewer") return;
  state.revisingActivityId = revisionRecord?.id || null;
  els.activityForm.reset();
  els.activityForm.elements.responsible.value = state.currentUser.authenticated ? state.currentUser.name : "";
  els.activityForm.elements.responsible.readOnly = state.currentUser.authenticated;
  els.checklistItems.replaceChildren();
  if (revisionRecord) {
    els.activityForm.elements.type.value = revisionRecord.type;
    els.activityForm.elements.status.value = revisionRecord.status;
    els.activityForm.elements.notes.value = revisionRecord.notes || "";
    revisionRecord.checklist.forEach(item => {
      addChecklistItem();
      const row = els.checklistItems.lastElementChild;
      row.querySelector('[name="checklistDescription"]').value = item.description;
      row.querySelector('[name="checklistResult"]').value = item.result;
    });
  } else {
    addChecklistItem();
  }
  els.modalTitle.textContent = revisionRecord
    ? state.currentUser.role === "admin"
      ? `Editar registro · ${selected.name}`
      : `Enviar correção · ${selected.name}`
    : `Registrar atividade · ${selected.name}`;
  els.modalBackdrop.classList.remove("hidden");
}

function closeModal() {
  els.modalBackdrop.classList.add("hidden");
  els.activityForm.reset();
  state.revisingActivityId = null;
}

function openEquipmentModal() {
  els.newEquipmentModal.classList.remove("hidden");
}

function closeEquipmentModal() {
  els.newEquipmentModal.classList.add("hidden");
  els.equipmentForm.reset();
}

async function addRecord(event) {
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
  try {
    const record = {
      type: formData.get("type"),
      status: formData.get("status"),
      responsible: formData.get("responsible").toString().trim(),
      checklist,
      notes: formData.get("notes").toString().trim()
    };
    const revisionPath = state.revisingActivityId
      ? `/api/activities/${encodeURIComponent(state.revisingActivityId)}/revisions`
      : "/api/activities";
    await apiRequest(revisionPath, {
      method: "POST",
      body: JSON.stringify(state.revisingActivityId ? { record } : {
        equipmentTag: selected.id,
        record
      })
    });
    state.equipment = (await apiRequest("/api/equipment")).equipment;
    state.currentTab = "records";
    closeModal();
    render();
  } catch (error) {
    window.alert(`Não foi possível salvar o registro: ${error.message}`);
  }
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

async function addEquipment(event) {
  event.preventDefault();
  const formData = new FormData(els.equipmentForm);
  const code = formData.get("code").toString().trim().toUpperCase();
  const body = {
    id: code,
    name: formData.get("name").toString().trim(),
    category: formData.get("category").toString().trim(),
    location: formData.get("location").toString().trim(),
    manufacturer: formData.get("manufacturer").toString().trim(),
    assetNumber: formData.get("asset").toString().trim()
  };
  try {
    const result = await apiRequest("/api/equipment", {
      method: "POST",
      body: JSON.stringify(body)
    });
    state.equipment = [result.equipment, ...(await apiRequest("/api/equipment")).equipment
      .filter(item => item.id !== result.equipment.id)];
    state.selectedId = result.equipment.id;
    closeEquipmentModal();
    render();
    showView("equipment");
  } catch (error) {
    window.alert(`Não foi possível cadastrar o equipamento: ${error.message}`);
  }
}

async function loadUsers() {
  try {
    const result = await apiRequest("/api/users");
    const roleOptions = [
      ["operator", "Operador/Técnico"],
      ["technical", "Operador/Técnico · Responsável técnico"],
      ["viewer", "Espectador · somente leitura"],
      ["admin", "Administrador Máximo"]
    ];
    els.userEquipmentAccess.innerHTML = state.equipment.map(item =>
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.name)}</option>`
    ).join("");
    els.userList.innerHTML = result.users.map(user => `
      <article class="user-list-item">
        <strong>${escapeHtml(user.name)}</strong>
        <span>${escapeHtml(user.username)} · ${escapeHtml(user.roleName)} · ${user.active ? "Ativo" : "Inativo"}</span>
        <label>Nome completo
          <input class="user-name-edit" data-username="${escapeHtml(user.username)}" type="text" maxlength="120" value="${escapeHtml(user.name)}" />
        </label>
        <label>Usuário
          <input class="user-username-edit" data-username="${escapeHtml(user.username)}" type="text" minlength="3" maxlength="40" value="${escapeHtml(user.username)}" autocomplete="off" />
        </label>
        <label>Perfil de acesso
          <select class="user-role-edit" data-username="${escapeHtml(user.username)}" ${user.id === state.currentUser.id ? "disabled" : ""}>
            ${roleOptions.map(([value, label]) => `<option value="${value}" ${user.role === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
        <label>Redefinir senha
          <input class="user-password-edit" data-username="${escapeHtml(user.username)}" type="password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Deixe vazio para manter" />
        </label>
        ${user.role === "admin" ? "<span>Acesso a todos os equipamentos.</span>" : `
          <label>Equipamentos autorizados
            <select class="user-access-edit" data-username="${escapeHtml(user.username)}" multiple size="4">
              ${state.equipment.map(item => `<option value="${escapeHtml(item.id)}" ${user.equipmentTags.includes(item.id) ? "selected" : ""}>${escapeHtml(item.id)} · ${escapeHtml(item.name)}</option>`).join("")}
            </select>
          </label>
        `}
        <button type="button" class="secondary-btn small save-user-settings-btn" data-username="${escapeHtml(user.username)}">Salvar alterações</button>
        <button type="button" class="secondary-btn small toggle-user-active-btn" data-username="${escapeHtml(user.username)}" data-active="${user.active ? "true" : "false"}" ${user.id === state.currentUser.id ? "disabled" : ""}>${user.active ? "Desativar conta" : "Reativar conta"}</button>
      </article>
    `).join("") || '<p class="empty-state">Nenhum usuário cadastrado.</p>';
    els.userList.querySelectorAll(".save-user-settings-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const item = button.closest(".user-list-item");
        const select = item.querySelector(".user-access-edit");
        const password = item.querySelector(".user-password-edit").value;
        const updates = {
          name: item.querySelector(".user-name-edit").value.trim(),
          username: item.querySelector(".user-username-edit").value.trim().toLowerCase(),
          role: item.querySelector(".user-role-edit").value
        };
        if (select) updates.equipmentTags = [...select.selectedOptions].map(option => option.value);
        if (password) updates.password = password;
        try {
          await apiRequest(`/api/users/${encodeURIComponent(button.dataset.username)}`, {
            method: "PUT",
            body: JSON.stringify(updates)
          });
          window.alert("Dados da conta atualizados. As sessões anteriores foram encerradas se a senha mudou.");
          await loadUsers();
        } catch (error) {
          window.alert(`Não foi possível atualizar a conta: ${error.message}`);
        }
      });
    });
    els.userList.querySelectorAll(".toggle-user-active-btn").forEach(button => {
      button.addEventListener("click", async () => {
        const active = button.dataset.active === "true";
        try {
          if (active) {
            await apiRequest(`/api/users/${encodeURIComponent(button.dataset.username)}`, {
              method: "DELETE",
              body: "{}"
            });
          } else {
            await apiRequest(`/api/users/${encodeURIComponent(button.dataset.username)}`, {
              method: "PUT",
              body: JSON.stringify({ active: true })
            });
          }
          await loadUsers();
        } catch (error) {
          window.alert(`Não foi possível alterar a situação da conta: ${error.message}`);
        }
      });
    });
  } catch (error) {
    window.alert(`Não foi possível carregar os usuários: ${error.message}`);
  }
}

async function addUser(event) {
  event.preventDefault();
  const formData = new FormData(els.userForm);
  const body = {
    name: formData.get("name").toString().trim(),
    username: formData.get("username").toString().trim(),
    password: formData.get("password").toString(),
    role: formData.get("role"),
    equipmentTags: formData.getAll("equipmentTags")
  };
  try {
    await apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify(body)
    });
    els.userForm.reset();
    await loadUsers();
  } catch (error) {
    window.alert(`Não foi possível criar o usuário: ${error.message}`);
  }
}

async function openAudit() {
  els.auditModal.classList.remove("hidden");
  els.auditList.innerHTML = '<p class="empty-state">Carregando auditoria...</p>';
  try {
    const result = await apiRequest("/api/audit");
    els.auditList.innerHTML = result.events.map(event => `
      <article class="audit-item">
        <strong>${escapeHtml(event.action)} · ${escapeHtml(event.subject)}</strong>
        <span>${escapeHtml(event.actorName || "Sistema")} (${escapeHtml(event.actor || "sem usuário")}) · ${escapeHtml(formatDateTime(event.createdAt))}</span>
        <span>Origem: ${escapeHtml(event.remoteAddress)}</span>
        <pre>${escapeHtml(JSON.stringify(event.details, null, 2))}</pre>
      </article>
    `).join("") || '<p class="empty-state">Nenhum evento registrado.</p>';
  } catch (error) {
    els.auditList.innerHTML = `<p class="form-message">${escapeHtml(error.message)}</p>`;
  }
}

function closeAudit() {
  els.auditModal.classList.add("hidden");
}

els.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.loginMessage.textContent = "";
  const body = {
    username: els.loginUsername.value.trim(),
    password: els.loginPassword.value
  };
  try {
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify(body)
    });
    els.loginPassword.value = "";
    await enterApplication(result.user);
    openEquipmentFromUrl();
  } catch (error) {
    els.loginMessage.textContent = error.message;
  }
});

els.setupForm.addEventListener("submit", async event => {
  event.preventDefault();
  els.setupMessage.textContent = "";
  const formData = new FormData(els.setupForm);
  const credentials = {
    name: formData.get("name").toString().trim(),
    username: formData.get("username").toString().trim().toLowerCase(),
    password: formData.get("password").toString()
  };
  try {
    await apiRequest("/api/setup", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    const result = await apiRequest("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password
      })
    });
    els.setupForm.reset();
    await enterApplication(result.user);
    openEquipmentFromUrl();
  } catch (error) {
    els.setupMessage.textContent = error.message;
  }
});

els.logoutBtn.addEventListener("click", async () => {
  try {
    await apiRequest("/api/logout", { method: "POST", body: "{}" });
    showLogin("Você saiu do LabTrack.");
  } catch (error) {
    window.alert(`Não foi possível encerrar a sessão: ${error.message}`);
  }
});

els.refreshUsersBtn.addEventListener("click", loadUsers);
els.auditBtn.addEventListener("click", openAudit);
els.closeAuditBtn.addEventListener("click", closeAudit);
els.auditModal.addEventListener("click", event => {
  if (event.target === els.auditModal) closeAudit();
});
els.userForm.addEventListener("submit", addUser);
els.reviewForm.addEventListener("submit", submitReview);
els.closeReviewModalBtn.addEventListener("click", closeReviewModal);
els.cancelReviewBtn.addEventListener("click", closeReviewModal);
els.reviewModal.addEventListener("click", event => {
  if (event.target === els.reviewModal) closeReviewModal();
});

els.activityBtn.addEventListener("click", () => openModal());
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
navButtons.forEach(button => button.addEventListener("click", () => {
  showView(button.dataset.view);
  if (button.dataset.view === "access") loadUsers();
}));

document.addEventListener("DOMContentLoaded", initialize);

window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeModal();
    closeEquipmentModal();
    closeAudit();
    closeReviewModal();
  }
});
