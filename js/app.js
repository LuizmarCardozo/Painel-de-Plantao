import { getPlantao } from "./api.js";

const elResponsavel = document.getElementById("responsavel");
const elPeriodo = document.getElementById("periodo");
const elContatos = document.getElementById("contatos");
const elUpdatedAt = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

// Pedro (apoio)
const openPedroBtn = document.getElementById("openPedroBtn");
const pedroDialog = document.getElementById("pedroDialog");
const pedroBody = document.getElementById("pedroBody");
const closePedroBtn = document.getElementById("closePedroBtn");

/* ============================
   Status Online/Offline helpers
   ============================ */
function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;

  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  return h * 60 + min;
}

function isNowInRange(inicio, fim, now = new Date()) {
  const start = parseTimeToMinutes(inicio);
  const end = parseTimeToMinutes(fim);
  if (start == null || end == null) return false;

  const nowM = now.getHours() * 60 + now.getMinutes();

  if (start < end) return nowM >= start && nowM < end;
  return nowM >= start || nowM < end;
}

function buildPresenceBadge(isOnline) {
  const badge = document.createElement("span");
  badge.className = `presence-badge ${isOnline ? "online" : "offline"}`;

  const dot = document.createElement("span");
  dot.className = "dot";

  const text = document.createElement("span");
  text.textContent = isOnline ? "Online" : "Offline";

  badge.appendChild(dot);
  badge.appendChild(text);
  return badge;
}

/* ============================
   Links / helpers
   ============================ */
function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}
function whatsappLink(phoneRaw) {
  const d = digitsOnly(phoneRaw);
  if (!d) return "";
  if (d.length >= 12 && d.startsWith("55")) return `https://wa.me/${d}`;
  if (d.length === 11) return `https://wa.me/55${d}`;
  return `https://wa.me/${d}`;
}
function telLink(phoneRaw) {
  const d = digitsOnly(phoneRaw);
  if (!d) return "";
  return `tel:${d}`;
}
function mailLink(email) {
  const e = String(email || "").trim();
  if (!e) return "";
  return `mailto:${e}`;
}
function formatUpdatedAt(iso) {
  if (!iso) return "Sem atualização ainda";
  return new Date(iso).toLocaleString("pt-BR");
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
  return map[m] || "";
}
function findColab(colabs, id) {
  return (colabs || []).find((c) => c.id === id) || null;
}
function clearNode(node) {
  if (!node) return;
  node.innerHTML = "";
}

/* ============================
   Render chips (responsável)
   ============================ */
function renderNames(colabsToday) {
  clearNode(elResponsavel);
  if (!elResponsavel) return;

  if (!colabsToday || !colabsToday.length) {
    const empty = document.createElement("div");
    empty.className = "name-chip empty";
    empty.textContent = "—";
    elResponsavel.appendChild(empty);
    return;
  }

  colabsToday.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "name-chip";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = (c.nome || "?").trim().charAt(0).toUpperCase();

    const name = document.createElement("div");
    name.className = "chip-text";
    name.textContent = c.nome || "—";

    chip.appendChild(avatar);
    chip.appendChild(name);
    elResponsavel.appendChild(chip);
  });
}

/* ============================
   Key-value row
   ============================ */
function addRow(parent, icon, label, value, url) {
  const row = document.createElement("div");
  row.className = "kv";

  const left = document.createElement("div");
  left.className = "kv-left";

  const k = document.createElement("div");
  k.className = "kv-k";
  k.innerHTML = `<span class="ico">${icon}</span> ${label}`;

  const v = document.createElement("div");
  v.className = "kv-v";
  v.textContent = value || "—";

  left.appendChild(k);
  left.appendChild(v);

  row.appendChild(left);

  if (url) {
    const a = document.createElement("a");
    a.className = "pill";
    a.href = url;
    a.target = url.startsWith("http") ? "_blank" : "_self";
    a.rel = "noreferrer";
    a.textContent = "Abrir";
    row.appendChild(a);
  } else {
    const spacer = document.createElement("div");
    spacer.className = "pill ghost";
    spacer.textContent = "";
    row.appendChild(spacer);
  }

  parent.appendChild(row);
}

/* ============================
   Contacts (cards) + ONLINE/OFFLINE
   ============================ */
function renderContacts(colabsToday, dayTimesForToday) {
  clearNode(elContatos);
  if (!elContatos) return;

  if (!colabsToday || !colabsToday.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-title">Nenhum responsável definido</div>
      <div class="empty-sub">Abra o Administrador e marque a escala do dia.</div>
    `;
    elContatos.appendChild(empty);
    return;
  }

  const now = new Date();

  colabsToday.forEach((colab) => {
    const card = document.createElement("div");
    card.className = "person-card";

    const head = document.createElement("div");
    head.className = "person-head";

    const title = document.createElement("div");
    title.className = "person-title";

    const avatar = document.createElement("div");
    avatar.className = "avatar lg";
    avatar.textContent = (colab.nome || "?").trim().charAt(0).toUpperCase();

    const nameBox = document.createElement("div");
    nameBox.innerHTML = `
      <div class="person-name">${colab.nome || "—"}</div>
      <div class="person-sub">Contatos do colaborador</div>
    `;

    title.appendChild(avatar);
    title.appendChild(nameBox);

    // status online/offline
    const dayT = dayTimesForToday?.[colab.id] || null;
    const online =
      dayT?.inicio && dayT?.fim
        ? isNowInRange(dayT.inicio, dayT.fim, now)
        : false;

    const presenceWrap = document.createElement("div");
    presenceWrap.className = "presence-wrap";
    presenceWrap.appendChild(buildPresenceBadge(online));

    head.appendChild(title);
    head.appendChild(presenceWrap);

    card.appendChild(head);

    const body = document.createElement("div");
    body.className = "person-body";

    // horário do dia
    if (dayT?.inicio || dayT?.fim) {
      addRow(
        body,
        "🕒",
        "Horário",
        `${dayT.inicio || "—"} → ${dayT.fim || "—"}`,
        "",
      );
    } else {
      addRow(body, "🕒", "Horário", "Horário não definido", "");
    }

    if (colab.whatsapp)
      addRow(
        body,
        "📱",
        "WhatsApp",
        colab.whatsapp,
        whatsappLink(colab.whatsapp),
      );
    if (colab.telefone)
      addRow(body, "☎️", "Telefone", colab.telefone, telLink(colab.telefone));
    if (colab.email)
      addRow(body, "✉️", "E-mail", colab.email, mailLink(colab.email));
    if (colab.obs) addRow(body, "📝", "Observações", colab.obs, "");

    card.appendChild(body);
    elContatos.appendChild(card);
  });
}

/* ============================
   Pedro (Apoio) - Modal
   ============================ */
function getPedroFromData(data) {
  const defaults = {
    nome: "Supervisor",
    whatsapp: "61999999999",
    telefone: "61999999999",
    email: "supervisor@gmail.com",
    obs: "Contato de apoio caso nenhum colaborador do plantão atenda.",
  };

  const apiPedro =
    data?.apoioPedro && typeof data.apoioPedro === "object"
      ? data.apoioPedro
      : {};

  // ✅ não deixa string vazia sobrescrever o default
  const pick = (key) => {
    const v = apiPedro[key];
    if (typeof v === "string") {
      const t = v.trim();
      return t ? t : defaults[key];
    }
    return v ?? defaults[key];
  };

  return {
    nome: pick("nome"),
    whatsapp: pick("whatsapp"),
    telefone: pick("telefone"),
    email: pick("email"),
    obs: pick("obs"),
  };
}
function renderPedroModal(pedro) {
  if (!pedroBody) return;
  pedroBody.innerHTML = "";

  let hasAny = false;

  if (pedro.whatsapp) {
    hasAny = true;
    addRow(
      pedroBody,
      "📱",
      "WhatsApp",
      pedro.whatsapp,
      whatsappLink(pedro.whatsapp),
    );
  }
  if (pedro.telefone) {
    hasAny = true;
    addRow(
      pedroBody,
      "☎️",
      "Telefone",
      pedro.telefone,
      telLink(pedro.telefone),
    );
  }
  if (pedro.email) {
    hasAny = true;
    addRow(pedroBody, "✉️", "E-mail", pedro.email, mailLink(pedro.email));
  }
  if (pedro.obs) {
    hasAny = true;
    addRow(pedroBody, "📝", "Observações", pedro.obs, "");
  }

  if (!hasAny) {
    const msg = document.createElement("div");
    msg.className = "empty-state";
    msg.innerHTML = `
      <div class="empty-title">Contato ainda não configurado</div>
      <div class="empty-sub">Você pode preencher futuramente (no JSON ou no código).</div>
    `;
    pedroBody.appendChild(msg);
  }
}

let pedroCache = null;

openPedroBtn?.addEventListener("click", () => {
  if (!pedroDialog) return;
  renderPedroModal(pedroCache || { nome: "PEDRO" });
  pedroDialog.showModal();
});
closePedroBtn?.addEventListener("click", () => pedroDialog?.close());

/* ============================
   Load & Render (robusto)
   ============================ */
async function loadAndRender() {
  try {
    if (elUpdatedAt) elUpdatedAt.textContent = "Atualizando…";

    const data = await getPlantao();
    pedroCache = getPedroFromData(data);

    const now = new Date();
    const day = String(now.getDate()); // "1".."31"
    const dayPad = day.padStart(2, "0"); // "01".."31"
    const m = now.getMonth() + 1;
    const y = now.getFullYear();

    const escala = data?.escala || {};
    const isSameMonth = Number(escala.month) === m && Number(escala.year) === y;

    let colabsToday = [];
    let dayTimesForToday = {};

    if (isSameMonth) {
      const mapOwners = escala?.dayOwnerIds || {};
      const ids = Array.isArray(mapOwners?.[day])
        ? mapOwners[day]
        : Array.isArray(mapOwners?.[dayPad])
          ? mapOwners[dayPad]
          : [];

      colabsToday = ids
        .map((id) => findColab(data.colaboradores || [], id))
        .filter(Boolean);

      const mapTimes = escala?.dayTimes || {};
      dayTimesForToday =
        mapTimes?.[day] && typeof mapTimes[day] === "object"
          ? mapTimes[day]
          : mapTimes?.[dayPad] && typeof mapTimes[dayPad] === "object"
            ? mapTimes[dayPad]
            : {};
    }

    renderNames(colabsToday);

    const dateLabel = `${String(now.getDate()).padStart(2, "0")}/${String(
      m,
    ).padStart(2, "0")}/${y}`;
    const monthLabel =
      escala?.month && escala?.year
        ? `${monthNamePt(escala.month)}/${escala.year}`
        : "";

    if (elPeriodo)
      elPeriodo.textContent = monthLabel
        ? `${dateLabel} • ${monthLabel}`
        : dateLabel;
    if (elUpdatedAt) elUpdatedAt.textContent = formatUpdatedAt(data.updatedAt);

    renderContacts(colabsToday, dayTimesForToday);
  } catch (e) {
    // não deixa travado em "Carregando…"
    if (elUpdatedAt)
      elUpdatedAt.textContent = "Sem conexão. Tentando novamente…";
  }
}

refreshBtn?.addEventListener("click", loadAndRender);
loadAndRender();
setInterval(loadAndRender, 30000);
