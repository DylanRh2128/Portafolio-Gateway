// Shared helpers for the portfolio pages: language switch (EN/ES), escaping, number formatting,
// and fetch with readable errors.

// --- i18n: each page's HTML holds the English text; pages register the Spanish (and any text
// built in JS) with i18n({en: {...}, es: {...}}). Elements opt in with data-i18n="key"
// (innerHTML) or data-i18n-ph="key" (placeholder).
const I18N = {
  en: {
    back: "← All projects",
    docs: "API docs (Swagger)",
    source: "Source on GitHub",
    raw: "Raw JSON response",
    err429: "Too many tries from your network — wait a minute and try again.",
    err413: "That file is too large for the demo.",
    errFail: "Request failed",
  },
  es: {
    back: "← Todos los proyectos",
    docs: "Documentación de la API (Swagger)",
    source: "Código en GitHub",
    raw: "Respuesta JSON cruda",
    err429: "Demasiados intentos desde tu red — espera un minuto y vuelve a intentar.",
    err413: "Ese archivo es demasiado grande para la demo.",
    errFail: "La solicitud falló",
  },
};

let LANG = (() => {
  try {
    const saved = localStorage.getItem("lang");
    if (saved === "en" || saved === "es") return saved;
  } catch {}
  return (navigator.language || "").toLowerCase().startsWith("es") ? "es" : "en";
})();

const t = key => I18N[LANG][key] ?? I18N.en[key] ?? key;

function applyLang() {
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const k = el.dataset.i18n;
    if (!(k in I18N.en)) I18N.en[k] = el.innerHTML;
    el.innerHTML = t(k);
  }
  for (const el of document.querySelectorAll("[data-i18n-ph]")) {
    const k = el.dataset.i18nPh;
    if (!(k in I18N.en)) I18N.en[k] = el.placeholder;
    el.placeholder = t(k);
  }
  if (!("title" in I18N.en)) I18N.en.title = document.title;
  document.title = t("title");
  for (const b of document.querySelectorAll(".lang button")) b.setAttribute("aria-pressed", b.dataset.lang === LANG);
  document.dispatchEvent(new Event("langchange"));
}

function i18n(strings) {
  Object.assign(I18N.en, strings.en);
  Object.assign(I18N.es, strings.es);
  const sw = document.createElement("div");
  sw.className = "lang";
  sw.setAttribute("role", "group");
  sw.setAttribute("aria-label", "Language / Idioma");
  sw.innerHTML = `<button type="button" data-lang="en">EN</button><button type="button" data-lang="es">ES</button>`;
  sw.addEventListener("click", e => {
    const lang = e.target.dataset.lang;
    if (!lang || lang === LANG) return;
    LANG = lang;
    try { localStorage.setItem("lang", lang); } catch {}
    applyLang();
  });
  document.body.prepend(sw);
  applyLang();
}

// --- helpers
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const money = n => Number(n).toLocaleString(LANG === "es" ? "es-CO" : "en-US", {maximumFractionDigits: 2});

async function call(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (res.ok) return data;
  const detail = res.status === 429 ? t("err429")
    : res.status === 413 ? t("err413")
    : (data && data.detail) ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
    : `${t("errFail")} (${res.status}).`;
  throw new Error(detail);
}

const raw = (data, title = t("raw")) =>
  `<details><summary>${esc(title)}</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>`;

// Runs fn with every button in `scope` disabled and errors rendered into `out`.
async function busy(scope, out, fn) {
  const buttons = scope.querySelectorAll("button");
  buttons.forEach(b => b.disabled = true);
  try { await fn(); }
  catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  finally { buttons.forEach(b => b.disabled = false); }
}
