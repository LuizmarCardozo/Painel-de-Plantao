// js/api.js
const CACHE_KEY = "disdal_plantao_cache_v1";

function baseUrl() {
  const b = window.__PLANTAO_API_BASE__ || "";
  return String(b).replace(/\/+$/, "");
}

function url(path) {
  const b = baseUrl();
  if (!b) return path; // mesma origem
  return b + path;
}

/* ============================
   Cache helpers
   ============================ */
function getCached() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCached(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

/* ============================
   Defaults + model migration
   ============================ */
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

function normalizeName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function defaultData() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  return {
    colaboradores: [],
    escala: {
      month,
      year,
      monthYear: `${monthNamePt(month)}/${year}`,
      dayOwnerIds: {},
      dayTimes: {},
    },
    apoioPedro: {
      nome: "Supervisor",
      whatsapp: "",
      telefone: "",
      email: "",
      obs: "Contato de apoio caso nenhum colaborador do plantão atenda.",
    },
    updatedAt: null,
  };
}

// Garante formato novo + migra formatos antigos
function ensureModelShape(raw) {
  let migrated = false;
  const next = typeof raw === "object" && raw ? { ...raw } : {};

  // colaboradores
  if (!Array.isArray(next.colaboradores)) {
    next.colaboradores = [];
    migrated = true;
  }

  // lista antiga (strings)
  if (next.colaboradores.length && typeof next.colaboradores[0] === "string") {
    next.colaboradores = next.colaboradores.map((n) => ({
      id: safeUUID(),
      nome: normalizeName(n),
    }));
    migrated = true;
  }

  // garante objetos e ids
  next.colaboradores = next.colaboradores.map((c) => {
    if (typeof c === "string") {
      migrated = true;
      return { id: safeUUID(), nome: normalizeName(c) };
    }
    const obj = { ...(c || {}) };
    if (!obj.id) {
      obj.id = safeUUID();
      migrated = true;
    }
    if (obj.nome != null) obj.nome = normalizeName(obj.nome);
    return obj;
  });

  // escala
  if (!next.escala || typeof next.escala !== "object") {
    next.escala = {};
    migrated = true;
  }

  // migração dayOwnerId -> dayOwnerIds
  if (next.escala.dayOwnerId && !next.escala.dayOwnerIds) {
    const old = next.escala.dayOwnerId || {};
    const converted = {};
    for (const k of Object.keys(old)) {
      const nk = String(Number(k)); // remove 01 -> 1
      const v = old[k];
      if (v) converted[nk] = [v];
    }
    next.escala.dayOwnerIds = converted;
    delete next.escala.dayOwnerId;
    migrated = true;
  }

  if (!next.escala.dayOwnerIds || typeof next.escala.dayOwnerIds !== "object") {
    next.escala.dayOwnerIds = {};
    migrated = true;
  }

  // normaliza chaves 01 -> 1 e garante arrays
  const normOwners = {};
  for (const k of Object.keys(next.escala.dayOwnerIds)) {
    const nk = String(Number(k));
    const v = next.escala.dayOwnerIds[k];
    const arr = Array.isArray(v) ? v : v ? [v] : [];
    normOwners[nk] = arr.filter(Boolean);
    if (nk !== k || !Array.isArray(v)) migrated = true;
  }
  next.escala.dayOwnerIds = normOwners;

  // dayTimes
  if (!next.escala.dayTimes || typeof next.escala.dayTimes !== "object") {
    next.escala.dayTimes = {};
    migrated = true;
  }
  const normTimes = {};
  for (const k of Object.keys(next.escala.dayTimes)) {
    const nk = String(Number(k));
    normTimes[nk] = next.escala.dayTimes[k] || {};
    if (nk !== k) migrated = true;
  }
  next.escala.dayTimes = normTimes;

  // month/year
  const now = new Date();
  if (!next.escala.month) {
    next.escala.month = now.getMonth() + 1;
    migrated = true;
  }
  if (!next.escala.year) {
    next.escala.year = now.getFullYear();
    migrated = true;
  }
  if (!next.escala.monthYear) {
    next.escala.monthYear = `${monthNamePt(next.escala.month)}/${
      next.escala.year
    }`;
    migrated = true;
  }

  // apoioPedro default
  if (!next.apoioPedro || typeof next.apoioPedro !== "object") {
    next.apoioPedro = {
      nome: "Supervisor",
      whatsapp: "",
      telefone: "",
      email: "",
      obs: "Contato de apoio caso nenhum colaborador do plantão atenda.",
    };
    migrated = true;
  }

  if (!("updatedAt" in next)) {
    next.updatedAt = null;
    migrated = true;
  }

  // 🔁 tenta converter dayOwnerIds que por acaso estejam com NOMES (antigo) em IDs
  const idSet = new Set(next.colaboradores.map((c) => c.id));
  const nameToId = new Map(
    next.colaboradores.map((c) => [normalizeName(c.nome), c.id]),
  );

  for (const day of Object.keys(next.escala.dayOwnerIds)) {
    const arr = next.escala.dayOwnerIds[day] || [];
    const mapped = arr
      .map((x) => {
        if (idSet.has(x)) return x;
        const maybe = nameToId.get(normalizeName(x));
        if (maybe) {
          migrated = true;
          return maybe;
        }
        return x;
      })
      .filter((x) => idSet.has(x)); // remove lixo
    next.escala.dayOwnerIds[day] = mapped;
  }

  return { data: next, migrated };
}

/* ============================
   Fetch helper
   ============================ */
async function fetchJson(path, opts = {}) {
  const r = await fetch(url(path), {
    cache: "no-store",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`HTTP ${r.status} ${r.statusText} ${txt}`.trim());
  }
  return r.json();
}

/* ============================
   API exports
   ============================ */
export async function getPlantao() {
  try {
    const raw = await fetchJson("/api/plantao");
    const { data, migrated } = ensureModelShape(raw);
    setCached(data);

    // se veio schema antigo do servidor, tenta salvar “corrigido” (best-effort)
    if (migrated) {
      try {
        const saved = await fetchJson("/api/plantao", {
          method: "PUT",
          body: JSON.stringify(data || {}),
        });
        const fixed = ensureModelShape(saved).data;
        setCached(fixed);
        return fixed;
      } catch {
        // ignora
      }
    }

    return data;
  } catch {
    const cached = getCached();
    return ensureModelShape(cached || defaultData()).data;
  }
}

export async function setPlantao(data) {
  try {
    const shaped = ensureModelShape(data || {}).data;
    const saved = await fetchJson("/api/plantao", {
      method: "PUT",
      body: JSON.stringify(shaped),
    });
    const fixed = ensureModelShape(saved).data;
    setCached(fixed);
    return fixed;
  } catch {
    const fallback = ensureModelShape(data || defaultData()).data;
    setCached(fallback);
    return fallback;
  }
}

export async function replacePlantao(data) {
  try {
    const shaped = ensureModelShape(data || {}).data;
    const saved = await fetchJson("/api/plantao/replace", {
      method: "POST",
      body: JSON.stringify(shaped),
    });
    const fixed = ensureModelShape(saved).data;
    setCached(fixed);
    return fixed;
  } catch {
    const fallback = ensureModelShape(data || defaultData()).data;
    setCached(fallback);
    return fallback;
  }
}

export async function resetPlantao() {
  try {
    const saved = await fetchJson("/api/plantao/reset", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const fixed = ensureModelShape(saved).data;
    setCached(fixed);
    return fixed;
  } catch {
    const d = defaultData();
    setCached(d);
    return d;
  }
}
