import { getPlantao, setPlantao, replacePlantao, resetPlantao } from "./api.js";

// ⚠️ Senha simples (client-side). Troque aqui:
const ADMIN_PASSWORD = "senha123";

/* =========================
   DOM
========================= */
const loginCard = document.getElementById("loginCard");
const adminCard = document.getElementById("adminCard");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");

const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");
const resetBtn = document.getElementById("resetBtn");
const saveBtn = document.getElementById("saveBtn");
const printBtn = document.getElementById("printBtn");

const saveStatus = document.getElementById("saveStatus");
const adminInfo = document.getElementById("adminInfo");

const calendarGrid = document.getElementById("calendarGrid");
const clearGridBtn = document.getElementById("clearGridBtn");

const monthSelect = document.getElementById("monthSelect");
const yearInput = document.getElementById("yearInput");
const applyMonthBtn = document.getElementById("applyMonthBtn");

// Colaborador: dialog
const openAddColabBtn = document.getElementById("openAddColabBtn");
const colabDialog = document.getElementById("colabDialog");
const colabForm = document.getElementById("colabForm");
const colabDialogTitle = document.getElementById("colabDialogTitle");

const colabId = document.getElementById("colabId");
const colabNome = document.getElementById("colabNome");
const colabWhats = document.getElementById("colabWhats");
const colabTel = document.getElementById("colabTel");
const colabEmail = document.getElementById("colabEmail");
const colabObs = document.getElementById("colabObs");
const cancelColabBtn = document.getElementById("cancelColabBtn");

// Horário por dia: dialog
const timeDialog = document.getElementById("timeDialog");
const timeDialogTitle = document.getElementById("timeDialogTitle");
const timeColabName = document.getElementById("timeColabName");
const timeDayLabel = document.getElementById("timeDayLabel");
const timeDay = document.getElementById("timeDay");
const timeColabId = document.getElementById("timeColabId");
const timeInicio = document.getElementById("timeInicio");
const timeFim = document.getElementById("timeFim");
const timeCancelBtn = document.getElementById("timeCancelBtn");
const timeRemoveTimeBtn = document.getElementById("timeRemoveTimeBtn");
const timeRemoveMarkBtn = document.getElementById("timeRemoveMarkBtn");
const timeSaveBtn = document.getElementById("timeSaveBtn");

/* =========================
   Auth
========================= */
const AUTH_KEY = "disdal_admin_authed";
function setAuthed(v) {
  sessionStorage.setItem(AUTH_KEY, v ? "1" : "0");
}
function isAuthed() {
  return sessionStorage.getItem(AUTH_KEY) === "1";
}

function showAdmin() {
  loginCard?.classList.add("hidden");
  adminCard?.classList.remove("hidden");
}
function showLogin() {
  adminCard?.classList.add("hidden");
  loginCard?.classList.remove("hidden");
}

function setStatus(msg) {
  if (saveStatus) saveStatus.textContent = msg || "";
}

/* =========================
   Fallback local (sem sumir tudo quando API para)
========================= */
const FALLBACK_KEY = "plantao_cache_fallback_v1";
let lastGoodState = null;

function readFallback() {
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeFallback(data) {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  } catch {}
}

async function safeGetPlantao() {
  try {
    const data = await getPlantao();
    lastGoodState = data;
    writeFallback(data);
    return data;
  } catch (e) {
    const cached = lastGoodState || readFallback();
    if (cached) {
      setStatus("⚠️ API offline: usando cache local (este navegador).");
      return cached;
    }
    setStatus("⚠️ API offline e sem cache local.");
    return {};
  }
}

async function safeSetPlantao(data) {
  lastGoodState = data;
  writeFallback(data);
  try {
    await setPlantao(data);
    return true;
  } catch (e) {
    setStatus("⚠️ API offline: alterações ficaram salvas localmente.");
    return false;
  }
}

async function safeReplacePlantao(data) {
  lastGoodState = data;
  writeFallback(data);
  try {
    await replacePlantao(data);
    return true;
  } catch {
    setStatus("⚠️ API offline: import aplicado só no cache local.");
    return false;
  }
}

async function safeResetPlantao() {
  lastGoodState = null;
  try {
    localStorage.removeItem(FALLBACK_KEY);
  } catch {}
  try {
    await resetPlantao();
    return true;
  } catch {
    setStatus("⚠️ API offline: reset aplicado só no cache local.");
    return false;
  }
}

/* =========================
   Utils
========================= */
function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function safeUUID() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return (
    "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16)
  );
}

function monthNamePt(month) {
  const m = Number(month);
  const map = {
    1: "JANEIRO",
    2: "FEVEREIRO",
    3: "MARÇO",
    4: "ABRIL",
    5: "MAIO",
    6: "JUNHO",
    7: "JULHO",
    8: "AGOSTO",
    9: "SETEMBRO",
    10: "OUTUBRO",
    11: "NOVEMBRO",
    12: "DEZEMBRO",
  };
  return map[m] || "MÊS";
}

function daysInMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  return new Date(y, m, 0).getDate(); // month 1..12
}

function weekdayLetter(year, month, day) {
  const w = new Date(Number(year), Number(month) - 1, Number(day)).getDay();
  const letters = ["D", "S", "T", "Q", "Q", "S", "S"];
  return letters[w] || "";
}

function alertSaved(message = "✅ Escala salva com sucesso!") {
  alert(message);
}

/* =========================
   Model + migração
========================= */
function ensureModelShape(data) {
  const next = { ...(data || {}) };

  if (!Array.isArray(next.colaboradores)) next.colaboradores = [];

  // Converte lista antiga (strings) para objetos
  if (next.colaboradores.length && typeof next.colaboradores[0] === "string") {
    next.colaboradores = next.colaboradores.map((n) => ({
      id: safeUUID(),
      nome: normalizeName(n),
    }));
  }

  if (!next.escala || typeof next.escala !== "object") next.escala = {};

  // migra do modelo antigo (dayOwnerId) se existir
  if (next.escala.dayOwnerId && !next.escala.dayOwnerIds) {
    const old = next.escala.dayOwnerId || {};
    const converted = {};
    for (const day of Object.keys(old)) {
      const id = old[day];
      if (id) converted[day] = [id];
    }
    next.escala.dayOwnerIds = converted;
    delete next.escala.dayOwnerId;
  }

  if (!next.escala.dayOwnerIds || typeof next.escala.dayOwnerIds !== "object")
    next.escala.dayOwnerIds = {};

  // ✅ horários por dia/colaborador
  if (!next.escala.dayTimes || typeof next.escala.dayTimes !== "object")
    next.escala.dayTimes = {}; // { "15": { "<colabId>": {inicio,fim} } }

  const now = new Date();
  const defaultMonth = now.getMonth() + 1;
  const defaultYear = now.getFullYear();

  if (!next.escala.month) next.escala.month = defaultMonth;
  if (!next.escala.year) next.escala.year = defaultYear;
  if (!next.escala.monthYear)
    next.escala.monthYear = `${monthNamePt(next.escala.month)}/${
      next.escala.year
    }`;

  return next;
}

function findColabById(colabs, id) {
  return colabs.find((c) => c.id === id) || null;
}

/* =========================
   Render Calendar
========================= */
function getTimeFor(state, day, colabIdVal) {
  const d = String(day);
  const cid = String(colabIdVal);
  const dayObj = state?.escala?.dayTimes?.[d];
  if (!dayObj || typeof dayObj !== "object") return null;
  const t = dayObj[cid];
  if (!t || typeof t !== "object") return null;
  return { inicio: t.inicio || "", fim: t.fim || "" };
}

function setTimeFor(state, day, colabIdVal, inicioStr, fimStr) {
  const d = String(day);
  const cid = String(colabIdVal);

  if (
    !state.escala.dayTimes[d] ||
    typeof state.escala.dayTimes[d] !== "object"
  ) {
    state.escala.dayTimes[d] = {};
  }
  state.escala.dayTimes[d][cid] = { inicio: inicioStr, fim: fimStr };
}

function removeTimeFor(state, day, colabIdVal) {
  const d = String(day);
  const cid = String(colabIdVal);

  const dayObj = state.escala.dayTimes[d];
  if (!dayObj || typeof dayObj !== "object") return;

  delete dayObj[cid];
  if (!Object.keys(dayObj).length) delete state.escala.dayTimes[d];
}

function getOwnersForDay(state, day) {
  const d = String(day);
  const arr = state?.escala?.dayOwnerIds?.[d];
  return Array.isArray(arr) ? arr : [];
}

function setOwnersForDay(state, day, arr) {
  const d = String(day);
  if (arr.length) state.escala.dayOwnerIds[d] = arr;
  else delete state.escala.dayOwnerIds[d];
}

function findCell(day, colabIdVal) {
  return document.querySelector(
    `td[data-day="${String(day)}"][data-colabid="${CSS.escape(
      String(colabIdVal),
    )}"]`,
  );
}

function updateCellVisual(td, isActive, hasTime, timeObj) {
  td.classList.toggle("active", isActive);
  td.classList.toggle("has-time", !!(isActive && hasTime));
  td.textContent = isActive ? "X" : "";

  if (isActive && hasTime && timeObj?.inicio && timeObj?.fim) {
    td.title = `Horário: ${timeObj.inicio} → ${timeObj.fim}`;
  } else {
    td.title = "";
  }
}

function buildCalendarUI(colaboradores, escala, fullState) {
  if (!calendarGrid) return;

  const month = Number(escala.month);
  const year = Number(escala.year);
  const totalDays = daysInMonth(year, month);

  const dayOwnerIds = escala.dayOwnerIds || {};

  const table = document.createElement("table");
  const thead = document.createElement("thead");

  const tr1 = document.createElement("tr");
  tr1.innerHTML =
    `<th>Colaborador</th>` +
    Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      return `<th>${String(d).padStart(2, "0")}</th>`;
    }).join("");
  thead.appendChild(tr1);

  const tr2 = document.createElement("tr");
  tr2.innerHTML =
    `<th class="weekday-head">Dia</th>` +
    Array.from({ length: totalDays }, (_, i) => {
      const d = i + 1;
      return `<th class="weekday">${weekdayLetter(year, month, d)}</th>`;
    }).join("");
  thead.appendChild(tr2);

  const tbody = document.createElement("tbody");

  if (!colaboradores.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td class="muted" colspan="${
      totalDays + 1
    }" style="padding: 14px; text-align:left;">
      Nenhum colaborador cadastrado. Clique em <strong>+ Adicionar colaborador</strong>.
    </td>`;
    tbody.appendChild(tr);
  } else {
    for (const c of colaboradores) {
      const tr = document.createElement("tr");

      const display = escapeHtml(c.nome || "SEM NOME");

      const thHtml = `
        <th>
          <div class="colab-cell">
            <div class="colab-left">
              <div class="colab-name">${display}</div>
            </div>

            <div class="colab-actions">
              <button type="button" class="mini-btn" data-action="edit" data-id="${escapeHtml(
                c.id,
              )}" title="Editar">✎</button>
              <button type="button" class="mini-btn danger" data-action="delete" data-id="${escapeHtml(
                c.id,
              )}" title="Excluir">🗑</button>
            </div>
          </div>
        </th>
      `;

      const tdsHtml = Array.from({ length: totalDays }, (_, i) => {
        const day = i + 1;
        const owners = Array.isArray(dayOwnerIds[String(day)])
          ? dayOwnerIds[String(day)]
          : [];
        const active = owners.includes(c.id);

        const t = getTimeFor(fullState, day, c.id);
        const hasTime = !!(t?.inicio && t?.fim);

        const cls = [
          active ? "active" : "",
          active && hasTime ? "has-time" : "",
        ]
          .filter(Boolean)
          .join(" ");

        const title =
          active && hasTime
            ? `title="Horário: ${escapeHtml(t.inicio)} → ${escapeHtml(t.fim)}"`
            : "";

        return `<td class="${cls}" data-day="${day}" data-colabid="${escapeHtml(
          c.id,
        )}" ${title}>${active ? "X" : ""}</td>`;
      }).join("");

      tr.innerHTML = thHtml + tdsHtml;
      tbody.appendChild(tr);
    }
  }

  table.appendChild(thead);
  table.appendChild(tbody);

  calendarGrid.innerHTML = "";
  calendarGrid.appendChild(table);

  // Delegação de eventos (evita rebind toda hora)
  wireCalendarEvents(tbody);
}

function updateAdminInfo(state) {
  if (!adminInfo) return;

  const s = ensureModelShape(state);
  const my = s.escala.monthYear ? s.escala.monthYear : "";
  const totalColabs = s.colaboradores.length;

  const map = s.escala.dayOwnerIds || {};
  const countDays = Object.keys(map).filter(
    (d) => Array.isArray(map[d]) && map[d].length > 0,
  ).length;

  adminInfo.textContent = `Escala: ${my} • Colaboradores: ${totalColabs} • Dias preenchidos: ${countDays}`;
}

/* =========================
   Clique / Duplo clique (CORRIGIDO)
   - Click: marca/desmarca
   - Dblclick em X: abre modal
========================= */
const tdTimers = new WeakMap();

function scheduleToggle(td) {
  const old = tdTimers.get(td);
  if (old) clearTimeout(old);

  const t = setTimeout(() => {
    tdTimers.delete(td);
    toggleMark(td);
  }, 260);

  tdTimers.set(td, t);
}

function cancelToggle(td) {
  const t = tdTimers.get(td);
  if (t) {
    clearTimeout(t);
    tdTimers.delete(td);
  }
}

function wireCalendarEvents(tbody) {
  if (!tbody) return;

  tbody.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-action][data-id]");
    if (btn) return; // ações tratadas abaixo

    const td = ev.target.closest("td[data-day][data-colabid]");
    if (!td) return;

    // se já tá ativo, atrasamos o toggle pra permitir dblclick abrir modal
    if (td.classList.contains("active")) {
      scheduleToggle(td);
      return;
    }

    // se não está ativo, marca imediatamente
    toggleMark(td);
  });

  tbody.addEventListener("dblclick", (ev) => {
    const td = ev.target.closest("td[data-day][data-colabid]");
    if (!td) return;

    // se tinha toggle pendente no click, cancela
    cancelToggle(td);

    // só abre modal se já estiver marcado (X)
    if (!td.classList.contains("active")) {
      setStatus(
        "Marque o X primeiro para depois definir o horário (duplo clique no X).",
      );
      return;
    }

    const day = String(td.dataset.day);
    const colabIdVal = String(td.dataset.colabid);
    openTimeDialog(day, colabIdVal);
  });

  // Editar/excluir colaborador (delegado)
  tbody.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-action][data-id]");
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    const state = ensureModelShape(await safeGetPlantao());
    const colab = findColabById(state.colaboradores, id);
    if (!colab) return;

    if (action === "edit") {
      openColabDialog(colab);
      return;
    }

    if (action === "delete") {
      const ok = confirm(
        `Excluir colaborador "${colab.nome}"?\nIsso também remove as marcações dele na escala.`,
      );
      if (!ok) return;
      await deleteColabById(id);
      return;
    }
  });
}

async function toggleMark(td) {
  const day = String(td.dataset.day);
  const colabIdVal = String(td.dataset.colabid);

  const state = ensureModelShape(await safeGetPlantao());

  const owners = [...getOwnersForDay(state, day)];
  const idx = owners.indexOf(colabIdVal);

  if (idx >= 0) {
    // desmarca
    owners.splice(idx, 1);
    setOwnersForDay(state, day, owners);

    // remove horário desse colab nesse dia também (pra não ficar lixo)
    removeTimeFor(state, day, colabIdVal);

    await safeSetPlantao(state);

    updateCellVisual(td, false, false, null);
    updateAdminInfo(state);
    return;
  }

  // marca
  owners.push(colabIdVal);
  setOwnersForDay(state, day, owners);

  await safeSetPlantao(state);

  const t = getTimeFor(state, day, colabIdVal);
  const hasTime = !!(t?.inicio && t?.fim);

  updateCellVisual(td, true, hasTime, t);
  updateAdminInfo(state);
}

/* =========================
   Modal de Horário (Início/Fim)
========================= */
function openTimeDialog(day, colabIdVal) {
  if (!timeDialog) return;

  const d = String(day);
  const cid = String(colabIdVal);

  timeDay.value = d;
  timeColabId.value = cid;

  const stateFromCache = ensureModelShape(
    lastGoodState || readFallback() || {},
  );
  const colab = findColabById(stateFromCache.colaboradores || [], cid);

  if (timeDialogTitle) timeDialogTitle.textContent = "Definir horário";
  if (timeColabName) timeColabName.textContent = colab?.nome || "—";
  if (timeDayLabel) timeDayLabel.textContent = String(d).padStart(2, "0");

  const t = getTimeFor(stateFromCache, d, cid);
  timeInicio.value = t?.inicio || "";
  timeFim.value = t?.fim || "";

  timeDialog.showModal();
}

timeCancelBtn?.addEventListener("click", () => timeDialog?.close());

timeSaveBtn?.addEventListener("click", async () => {
  const d = timeDay?.value;
  const cid = timeColabId?.value;

  const inicio = (timeInicio?.value || "").trim();
  const fim = (timeFim?.value || "").trim();

  if (!d || !cid) return;

  // exige os dois (pra online/offline ficar certo)
  if (!inicio || !fim) {
    alert("Preencha Horário de Início e Horário de Fim.");
    return;
  }

  const state = ensureModelShape(await safeGetPlantao());

  // garante que ainda está marcado
  const owners = [...getOwnersForDay(state, d)];
  if (!owners.includes(cid)) {
    alert("Esse colaborador não está marcado neste dia. Marque o X primeiro.");
    timeDialog.close();
    return;
  }

  setTimeFor(state, d, cid, inicio, fim);
  await safeSetPlantao(state);

  // atualiza a célula sem re-render
  const td = findCell(d, cid);
  if (td) {
    updateCellVisual(td, true, true, { inicio, fim });
  }

  updateAdminInfo(state);
  setStatus("Horário salvo.");
  timeDialog.close();
});

timeRemoveTimeBtn?.addEventListener("click", async () => {
  const d = timeDay?.value;
  const cid = timeColabId?.value;
  if (!d || !cid) return;

  const state = ensureModelShape(await safeGetPlantao());
  removeTimeFor(state, d, cid);
  await safeSetPlantao(state);

  const td = findCell(d, cid);
  if (td) {
    updateCellVisual(td, true, false, null);
  }

  updateAdminInfo(state);
  setStatus("Horário removido (marcação mantida).");
  timeDialog.close();
});

timeRemoveMarkBtn?.addEventListener("click", async () => {
  const d = timeDay?.value;
  const cid = timeColabId?.value;
  if (!d || !cid) return;

  const state = ensureModelShape(await safeGetPlantao());

  // remove da escala
  const owners = [...getOwnersForDay(state, d)].filter((x) => x !== cid);
  setOwnersForDay(state, d, owners);

  // remove horário
  removeTimeFor(state, d, cid);

  await safeSetPlantao(state);

  const td = findCell(d, cid);
  if (td) updateCellVisual(td, false, false, null);

  updateAdminInfo(state);
  setStatus("Marcação removida.");
  timeDialog.close();
});

/* =========================
   Colaborador dialog
========================= */
function openColabDialog(colab) {
  const editing = !!colab?.id;

  if (colabDialogTitle) {
    colabDialogTitle.textContent = editing
      ? "Editar colaborador"
      : "Adicionar colaborador";
  }

  colabId.value = editing ? colab.id : "";
  colabNome.value = colab?.nome || "";
  colabWhats.value = colab?.whatsapp || "";
  colabTel.value = colab?.telefone || "";
  colabEmail.value = colab?.email || "";
  colabObs.value = colab?.obs || "";

  colabDialog?.showModal();
  setTimeout(() => colabNome?.focus(), 50);
}

cancelColabBtn?.addEventListener("click", () => colabDialog?.close());

openAddColabBtn?.addEventListener("click", () => {
  openColabDialog({
    id: "",
    nome: "",
    whatsapp: "",
    telefone: "",
    email: "",
    obs: "",
  });
});

colabForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = colabId.value || "";
  const nome = normalizeName(colabNome.value);
  const whatsapp = colabWhats.value.trim();
  const telefone = colabTel.value.trim();
  const email = colabEmail.value.trim();
  const obs = colabObs.value.trim();

  if (!nome) {
    alert("Informe o nome do colaborador.");
    colabNome.focus();
    return;
  }

  const state = ensureModelShape(await safeGetPlantao());
  const colabs = [...state.colaboradores];

  if (id) {
    const idx = colabs.findIndex((c) => c.id === id);
    if (idx < 0) return;

    const duplicate = colabs.some(
      (c) => c.id !== id && normalizeName(c.nome) === nome,
    );
    if (duplicate) {
      alert("Já existe um colaborador com esse nome.");
      return;
    }

    colabs[idx] = { ...colabs[idx], nome, whatsapp, telefone, email, obs };
  } else {
    const duplicate = colabs.some((c) => normalizeName(c.nome) === nome);
    if (duplicate) {
      alert("Já existe um colaborador com esse nome.");
      return;
    }

    colabs.push({ id: safeUUID(), nome, whatsapp, telefone, email, obs });
  }

  state.colaboradores = colabs;
  await safeSetPlantao(state);

  colabDialog.close();
  setStatus("Colaborador salvo.");
  await loadForm();
});

async function deleteColabById(id) {
  const state = ensureModelShape(await safeGetPlantao());

  const nextColabs = state.colaboradores.filter((c) => c.id !== id);

  // limpa escala (remove esse colaborador de todos os dias)
  const nextMap = { ...(state.escala.dayOwnerIds || {}) };
  for (const day of Object.keys(nextMap)) {
    const arr = Array.isArray(nextMap[day]) ? nextMap[day] : [];
    const filtered = arr.filter((x) => x !== id);
    if (filtered.length) nextMap[day] = filtered;
    else delete nextMap[day];
  }

  // limpa horários (remove esse colaborador de todos os dias)
  const nextTimes = { ...(state.escala.dayTimes || {}) };
  for (const day of Object.keys(nextTimes)) {
    const obj = nextTimes[day];
    if (obj && typeof obj === "object") {
      delete obj[id];
      if (!Object.keys(obj).length) delete nextTimes[day];
    }
  }

  state.colaboradores = nextColabs;
  state.escala.dayOwnerIds = nextMap;
  state.escala.dayTimes = nextTimes;

  await safeSetPlantao(state);
  setStatus("Colaborador excluído.");
  await loadForm();
}

/* =========================
   Month/year handlers
========================= */
async function applyMonthYear() {
  const m = Number(monthSelect.value);
  const y = Number(yearInput.value);

  if (!m || m < 1 || m > 12) return setStatus("Mês inválido.");
  if (!y || y < 2000 || y > 2100) return setStatus("Ano inválido.");

  const state = ensureModelShape(await safeGetPlantao());
  state.escala.month = m;
  state.escala.year = y;
  state.escala.monthYear = `${monthNamePt(m)}/${y}`;

  await safeSetPlantao(state);
  setStatus("Mês/ano aplicado.");
  await loadForm();
}
applyMonthBtn?.addEventListener("click", applyMonthYear);

/* =========================
   Buttons
========================= */
clearGridBtn?.addEventListener("click", async () => {
  const ok = confirm("Limpar TODA a escala deste mês?");
  if (!ok) return;

  const state = ensureModelShape(await safeGetPlantao());
  state.escala.dayOwnerIds = {};
  state.escala.dayTimes = {};
  await safeSetPlantao(state);

  setStatus("Escala limpa.");
  await loadForm();
});

saveBtn?.addEventListener("click", async () => {
  const state = ensureModelShape(await safeGetPlantao());
  await safeSetPlantao(state);

  setStatus("Escala salva.");
  alertSaved("✅ Escala salva com sucesso!");
  updateAdminInfo(state);
});

printBtn?.addEventListener("click", () => {
  window.print();
});

exportBtn?.addEventListener("click", async () => {
  const data = ensureModelShape(await safeGetPlantao());
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "plantao-disdaltech.json";
  a.click();

  URL.revokeObjectURL(url);
});

importFile?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const text = await file.text();
  try {
    const json = JSON.parse(text);
    await safeReplacePlantao(ensureModelShape(json));
    setStatus("Importado e aplicado com sucesso.");
    await loadForm();
  } catch {
    setStatus("Erro ao importar: JSON inválido.");
  } finally {
    importFile.value = "";
  }
});

resetBtn?.addEventListener("click", async () => {
  const ok = confirm("Resetar tudo? (colaboradores e escala serão apagados)");
  if (!ok) return;

  await safeResetPlantao();

  // garante estado em branco local
  const blank = ensureModelShape({ colaboradores: [], escala: {} });
  writeFallback(blank);
  lastGoodState = blank;

  setStatus("Resetado (em branco).");
  await loadForm();
});

/* =========================
   Load / Login / Boot
========================= */
async function loadForm() {
  const data = ensureModelShape(await safeGetPlantao());

  // salva migração automaticamente
  await safeSetPlantao(data);

  if (monthSelect) monthSelect.value = String(data.escala.month);
  if (yearInput) yearInput.value = String(data.escala.year);

  buildCalendarUI(data.colaboradores, data.escala, data);
  updateAdminInfo(data);
}

loginBtn?.addEventListener("click", async () => {
  const typed = passwordInput?.value || "";
  if (typed === ADMIN_PASSWORD) {
    setAuthed(true);
    showAdmin();
    await loadForm();
  } else {
    setStatus("Senha incorreta.");
  }
});

(async () => {
  if (isAuthed()) {
    showAdmin();
    await loadForm();
  } else {
    showLogin();
  }
})();
