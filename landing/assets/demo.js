// Shared helpers for the demo pages: escaping, number formatting, and fetch with readable errors.
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const money = n => Number(n).toLocaleString("en-US", {maximumFractionDigits: 2});

async function call(url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (res.ok) return data;
  const detail = res.status === 429 ? "Too many tries from your network — wait a minute and try again."
    : res.status === 413 ? "That file is too large for the demo."
    : (data && data.detail) ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail))
    : `Request failed (${res.status}).`;
  throw new Error(detail);
}

const raw = (data, title = "Raw JSON response") =>
  `<details><summary>${esc(title)}</summary><pre>${esc(JSON.stringify(data, null, 2))}</pre></details>`;

// Runs fn with every button in `scope` disabled and errors rendered into `out`.
async function busy(scope, out, fn) {
  const buttons = scope.querySelectorAll("button");
  buttons.forEach(b => b.disabled = true);
  try { await fn(); }
  catch (e) { out.innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  finally { buttons.forEach(b => b.disabled = false); }
}
