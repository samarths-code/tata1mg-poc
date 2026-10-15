"""
Admin page for managing organisations (VideoSDK API key + secret + meeting
config per client). Everything is stored in orgs.json via org_store.

    GET  /<ADMIN_PATH>/                       the page
    GET  /<ADMIN_PATH>/api/orgs               list orgs (secrets masked)
    POST /<ADMIN_PATH>/api/orgs               create / update an org
    GET  /<ADMIN_PATH>/api/builds             each org's frontend domain + last upload
    POST /<ADMIN_PATH>/api/orgs/<id>/build    upload a .zip build (see builds.py)

Nothing is guessable: the URL path (ADMIN_PATH), the Basic-auth username
(ADMIN_USERNAME) and password (ADMIN_PASSWORD) all come from .env. Unless all
three are set (path at least 12 chars) the blueprint is never registered, so
every admin URL is a plain 404. POSTs must be JSON, which a cross-site form
cannot send — that, plus no CORS headers on admin routes, keeps other sites
from using the browser's cached credentials (CSRF). The build upload is
multipart, so it needs an X-Admin-Upload header instead: a cross-site form
can't set one, and a cross-origin fetch with it needs a preflight we never
answer.
"""
import datetime
import hmac
import ipaddress
import os
import re
import threading
import time
from functools import wraps

import jwt
import requests
from flask import Blueprint, Response, jsonify, request

try:
    from . import builds, org_store
except ImportError:
    import builds
    import org_store

bp = Blueprint("admin", __name__)

ADMIN_PATH_PATTERN = re.compile(r"^[A-Za-z0-9_-]{12,64}$")


def admin_url_prefix():
    """URL prefix for the admin blueprint, or None when admin is disabled."""
    path = os.environ.get("ADMIN_PATH", "").strip().strip("/")
    if not (path and os.environ.get("ADMIN_USERNAME") and os.environ.get("ADMIN_PASSWORD")):
        return None
    if not ADMIN_PATH_PATTERN.match(path):
        raise RuntimeError("ADMIN_PATH must be 12-64 chars of letters, digits, - or _")
    return f"/{path}"

VIDEOSDK_API = "https://api.videosdk.live"

# Room configs offered as starting points in the page. Merged into the
# POST /v2/rooms body; the webhook URL is filled in by the backend.
PRESETS = {
    "standard": {},
    "recording": {
        "autoStartConfig": {
            "recording": {
                "enabled": True,
                "onFailure": {"waitTime": 60, "action": "close-room"},
            }
        }
    },
    "post-transcription": {
        "autoStartConfig": {
            "recording": {
                "enabled": True,
                "transcription": {
                    "enabled": True,
                    "summary": {
                        "enabled": True,
                        "prompt": "Write summary in sections like Title, Agenda, Speakers, Action Items, Outlines, Notes and Summary",
                    },
                },
                "onFailure": {"waitTime": 60, "action": "close-room"},
            }
        }
    },
}


# Failed-login lockout: MAX_FAILURES wrong passwords from one IP within
# FAILURE_WINDOW seconds -> 429 until the oldest failure ages out. Kept in
# memory per gunicorn worker (2 workers = at most 2x the attempts), which is
# plenty to stop guessing without adding a shared store.
MAX_FAILURES = 10
FAILURE_WINDOW = 15 * 60
_failures = {}
_failures_lock = threading.Lock()


def _client_ip() -> str:
    """nginx overwrites X-Forwarded-For with the peer address, so it can be
    trusted only when the request came through the local proxy."""
    remote = request.remote_addr or ""
    try:
        local = ipaddress.ip_address(remote).is_loopback
    except ValueError:
        local = False
    if local:
        forwarded = request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        if forwarded:
            return forwarded
    return remote


def _recent_failures(ip: str, now: float) -> list:
    recent = [t for t in _failures.get(ip, []) if now - t < FAILURE_WINDOW]
    if recent:
        _failures[ip] = recent
    else:
        _failures.pop(ip, None)
    return recent


def require_admin(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        ip = _client_ip()
        now = time.time()
        with _failures_lock:
            recent = _recent_failures(ip, now)
        if len(recent) >= MAX_FAILURES:
            retry = int(FAILURE_WINDOW - (now - recent[0])) + 1
            return Response(
                "Too many failed logins — try again later", 429,
                {"Retry-After": str(retry)},
            )

        username = os.environ.get("ADMIN_USERNAME", "")
        password = os.environ.get("ADMIN_PASSWORD", "")
        auth = request.authorization
        ok = (
            bool(username and password)
            and auth is not None
            # & (not and) so both comparisons always run — no timing hint
            # about which of the two was wrong.
            and hmac.compare_digest(auth.username or "", username)
            & hmac.compare_digest(auth.password or "", password)
        )
        if not ok:
            # A bare request without credentials is the browser asking for
            # the login prompt — only count actual wrong guesses.
            if auth is not None:
                with _failures_lock:
                    _failures.setdefault(ip, []).append(now)
            return Response(
                "Authentication required", 401,
                {"WWW-Authenticate": 'Basic realm="Org admin"'},
            )
        with _failures_lock:
            _failures.pop(ip, None)
        if request.method == "POST" and not request.is_json:
            upload = request.endpoint == "admin.admin_upload_build"
            if not (upload and request.headers.get("X-Admin-Upload") == "1"):
                return jsonify({"message": "Expected application/json"}), 415
        return view(*args, **kwargs)
    return wrapper


@bp.after_request
def security_headers(response: Response) -> Response:
    # The page is self-contained (inline script + style), never framed, and
    # its responses carry API keys — don't cache them anywhere.
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
        "frame-ancestors 'none'; form-action 'self'; base-uri 'none'"
    )
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


def _mask(secret: str) -> str:
    return f"••••{secret[-4:]}" if len(secret) > 4 else "••••"


def _public(org_id: str, org: dict) -> dict:
    return {
        "id": org_id,
        "name": org.get("name", ""),
        "apiKey": org.get("apiKey", ""),
        "secret": _mask(org.get("secret", "")),
        "webhookUrl": org.get("webhookUrl", ""),
        "frontendOrigins": org.get("frontendOrigins") or [],
        "frontendDomain": org.get("frontendDomain", ""),
        "roomConfig": org.get("roomConfig") or {},
    }


def _check_credentials(api_key: str, secret: str):
    """Ask VideoSDK whether the key/secret pair is valid. Returns an error
    message, or None when valid (or when VideoSDK can't be reached — saving
    shouldn't depend on the network)."""
    now = datetime.datetime.utcnow()
    token = jwt.encode(
        {"apikey": api_key, "permissions": ["allow_join"], "version": 2,
         "roles": ["crawler"], "iat": now, "exp": now + datetime.timedelta(minutes=2)},
        secret, algorithm="HS256",
    )
    try:
        res = requests.get(
            f"{VIDEOSDK_API}/v2/rooms?page=1&perPage=1",
            headers={"Authorization": token}, timeout=10,
        )
    except requests.RequestException:
        return None
    # VideoSDK answers bad credentials with 400: code 4001 = invalid API key,
    # 4002 = token didn't verify (wrong secret). 5xx = their problem, allow.
    if res.status_code in (400, 401, 403):
        try:
            code = res.json().get("code")
        except ValueError:
            code = None
        if code == 4001:
            return "VideoSDK rejected this API key"
        if code == 4002:
            return "VideoSDK rejected this secret for that API key"
        return "VideoSDK rejected these credentials"
    return None


@bp.route("/", methods=["GET"])
@require_admin
def admin_page():
    base = request.path.rstrip("/")
    return Response(ADMIN_HTML.replace("__BASE__", base), mimetype="text/html")


@bp.route("/api/orgs", methods=["GET"])
@require_admin
def admin_list_orgs():
    orgs = org_store.list_orgs()
    return jsonify({
        "orgs": [_public(oid, o) for oid, o in sorted(orgs.items())],
        "presets": PRESETS,
    })


@bp.route("/api/orgs", methods=["POST"])
@require_admin
def admin_save_org():
    body = request.get_json(silent=True) or {}
    org_id = str(body.get("id", "")).strip().lower()
    if not org_store.ORG_ID_PATTERN.match(org_id) or org_id == org_store.DEFAULT_ORG_ID:
        return jsonify({"message": "Org ID: lowercase letters, digits, - or _ (not \"default\")"}), 400

    existing = org_store.list_orgs().get(org_id, {})
    api_key = str(body.get("apiKey", "")).strip()
    # Blank secret on edit = keep the stored one (it is never sent to the page).
    secret = str(body.get("secret", "")).strip() or existing.get("secret", "")
    if not api_key or not secret:
        return jsonify({"message": "API key and secret are required"}), 400

    room_config = body.get("roomConfig") or {}
    if not isinstance(room_config, dict):
        return jsonify({"message": "Room config must be a JSON object"}), 400

    raw_origins = body.get("frontendOrigins") or []
    if isinstance(raw_origins, str):
        raw_origins = raw_origins.split(",")
    origins = []
    for o in raw_origins:
        o = org_store.normalize_origin(str(o))
        if not o:
            continue
        if not org_store.ORIGIN_PATTERN.match(o):
            return jsonify({"message": f"Invalid frontend origin: {o} (use https://host[:port])"}), 400
        if o not in origins:
            origins.append(o)

    domain = str(body.get("frontendDomain", "")).strip().lower()
    domain = re.sub(r"^https?://", "", domain).rstrip("/")
    if domain and not org_store.DOMAIN_PATTERN.match(domain):
        return jsonify({"message": f"Invalid frontend domain: {domain} (just the host, e.g. client.videosdk.live)"}), 400

    error = _check_credentials(api_key, secret)
    if error:
        return jsonify({"message": error}), 400

    org = {
        "name": str(body.get("name", "")).strip() or org_id,
        "apiKey": api_key,
        "secret": secret,
        "webhookUrl": str(body.get("webhookUrl", "")).strip(),
        "frontendOrigins": origins,
        "frontendDomain": domain,
        "roomConfig": room_config,
    }
    org_store.save_org(org_id, org)
    return jsonify({"org": _public(org_id, org)}), 200


@bp.route("/api/builds", methods=["GET"])
@require_admin
def admin_list_builds():
    sites = []
    for org_id, org in sorted(org_store.list_orgs().items()):
        domain = org.get("frontendDomain", "")
        sites.append({
            "id": org_id,
            "name": org.get("name", ""),
            "domain": domain,
            "siteExists": bool(domain) and builds.site_exists(domain),
            "lastBuild": builds.build_info(domain) if domain else None,
        })
    return jsonify({"sites": sites, "maxZipBytes": builds.MAX_ZIP_BYTES})


@bp.route("/api/orgs/<org_id>/build", methods=["POST"])
@require_admin
def admin_upload_build(org_id):
    org = org_store.list_orgs().get(org_id)
    if org is None:
        return jsonify({"message": f"Unknown org: {org_id}"}), 404
    domain = org.get("frontendDomain", "")
    if not domain:
        return jsonify({"message": "Set a frontend domain for this org first"}), 400
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        return jsonify({"message": "Choose a .zip file"}), 400
    try:
        info = builds.deploy_zip(
            org_id, domain, upload.stream, upload.filename,
            force=request.form.get("force") == "1",
        )
    except builds.BuildError as e:
        return jsonify({"message": str(e)}), 400
    return jsonify({"build": info, "url": f"https://{domain}/"}), 200


ADMIN_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Org admin</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --text:#1d2330; --muted:#667085; --line:#e4e7ec;
          --accent:#3b5bdb; --danger:#c92a2a; --ok:#2b8a3e; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#12151b; --card:#1b1f27; --text:#e6e8ec; --muted:#98a2b3; --line:#2c323d;
            --accent:#7b93ff; --danger:#ff6b6b; --ok:#69db7c; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 960px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.sub { color: var(--muted); margin: 0 0 20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  td code { font-size:12px; word-break:break-all; }
  .tag { font-size:11px; padding:1px 6px; border-radius:99px; border:1px solid var(--line); color:var(--muted); }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
  @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .hide-sm { display:none; } }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
  input, select, textarea { width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:8px;
         background:var(--bg); color:var(--text); font:inherit; }
  textarea { font-family: ui-monospace, Menlo, monospace; font-size:12px; min-height:180px; }
  .full { grid-column: 1 / -1; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  button { padding:8px 14px; border-radius:8px; border:1px solid var(--line); background:var(--card);
           color:var(--text); font:inherit; cursor:pointer; }
  button.primary { background:var(--accent); border-color:var(--accent); color:#fff; }
  button.link { border:none; background:none; color:var(--accent); padding:2px 4px; }
  #msg { min-height:20px; }
  #msg.err { color:var(--danger); } #msg.ok { color:var(--ok); }
  .hint { color:var(--muted); font-size:12px; margin-top:4px; }
  .tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:16px; }
  .tabs button { border:none; border-bottom:2px solid transparent; border-radius:0; background:none;
                 color:var(--muted); padding:8px 12px; }
  .tabs button[aria-selected="true"] { color:var(--text); border-bottom-color:var(--accent); }
  .bmsg { font-size:12px; display:block; margin-top:4px; }
  .bmsg.err { color:var(--danger); } .bmsg.ok { color:var(--ok); }
  .site td { vertical-align:middle; }
  .site input[type=file] { width:auto; max-width:220px; padding:4px; font-size:12px; }
  .site label.inline { display:inline-flex; gap:4px; align-items:center; margin:0; white-space:nowrap; }
  .site label.inline input { width:auto; }
</style>
</head>
<body>
<main>
  <h1>Org admin</h1>
  <p class="sub">Each client build sends its Org ID; the backend signs every token and VideoSDK call with that org's key and secret.</p>

  <nav class="tabs" role="tablist">
    <button type="button" role="tab" data-tab="orgs" aria-selected="true">Organisations</button>
    <button type="button" role="tab" data-tab="builds" aria-selected="false">Frontend builds</button>
  </nav>

  <section id="tab-orgs">
  <div class="card">
    <table>
      <thead><tr><th>Org ID</th><th>Name</th><th class="hide-sm">Origins</th><th class="hide-sm">API key</th><th class="hide-sm">Secret</th><th>Meeting</th><th></th></tr></thead>
      <tbody id="rows"><tr><td colspan="7">Loading…</td></tr></tbody>
    </table>
  </div>

  <div class="card">
    <h2 id="formTitle" style="font-size:16px;margin:0 0 12px">Add organisation</h2>
    <form id="form" class="grid" autocomplete="off">
      <div><label for="id">Org ID (send as REACT_APP_ORG_ID)</label>
        <input id="id" required pattern="[a-z0-9][a-z0-9_-]{0,63}" placeholder="eureka-forbes"></div>
      <div><label for="name">Display name</label><input id="name" placeholder="Eureka Forbes"></div>
      <div><label for="apiKey">VideoSDK API key</label><input id="apiKey" required></div>
      <div><label for="secret">VideoSDK secret</label><input id="secret" type="password">
        <div class="hint" id="secretHint">Required for a new org.</div></div>
      <div class="full"><label for="frontendOrigins">Frontend origins (comma-separated; allowed by CORS)</label>
        <input id="frontendOrigins" placeholder="https://eurekaforbes.videosdk.live, http://localhost:3000"></div>
      <div class="full"><label for="frontendDomain">Frontend domain (where uploaded builds go live)</label>
        <input id="frontendDomain" placeholder="eurekaforbes.videosdk.live"></div>
      <div class="full"><label for="webhookUrl">Webhook URL (optional, falls back to VIDEOSDK_WEBHOOK_URL)</label>
        <input id="webhookUrl" placeholder="https://your-backend/webhooks/videosdk"></div>
      <div class="full">
        <div class="row" style="justify-content:space-between">
          <label for="roomConfig" style="margin:0">Create-meeting config (merged into POST /v2/rooms)</label>
          <div class="row"><span class="hint" style="margin:0">Preset:</span>
            <select id="preset" style="width:auto">
              <option value="">—</option>
              <option value="standard">Standard (no recording)</option>
              <option value="recording">Recording only</option>
              <option value="post-transcription">Recording + post transcription &amp; summary</option>
            </select></div>
        </div>
        <textarea id="roomConfig" spellcheck="false">{}</textarea>
      </div>
      <div class="full row">
        <button type="submit" class="primary">Save</button>
        <button type="button" id="clearBtn">Clear</button>
        <span id="msg"></span>
      </div>
    </form>
  </div>
  </section>

  <section id="tab-builds" hidden>
  <div class="card">
    <p class="hint" style="margin:0 0 12px">Upload a .zip of a client's build folder (max <span id="maxZip">20</span> MB). It replaces the live site on that org's frontend domain; the previous build is kept on the server as <code>public.prev</code>.</p>
    <table>
      <thead><tr><th>Org</th><th>Domain</th><th class="hide-sm">Last upload</th><th>Upload build</th></tr></thead>
      <tbody id="siteRows"><tr><td colspan="4">Loading…</td></tr></tbody>
    </table>
  </div>
  </section>
</main>
<script>
const BASE = "__BASE__";
let presets = {};
let orgs = [];
const $ = (id) => document.getElementById(id);

function setMsg(text, kind) { const m = $("msg"); m.textContent = text; m.className = kind || ""; }

async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || ("Request failed: " + res.status));
  return data;
}

function meetingLabel(cfg) {
  const rec = cfg && cfg.autoStartConfig && cfg.autoStartConfig.recording;
  if (rec && rec.transcription && rec.transcription.enabled) return "Recording + transcription";
  if (rec) return "Recording only";
  return Object.keys(cfg || {}).length ? "Custom" : "Standard";
}

function render() {
  const rows = $("rows");
  rows.textContent = "";
  if (!orgs.length) {
    rows.innerHTML = '<tr><td colspan="7">No organisations yet. Requests without an Org ID use the .env key.</td></tr>';
    return;
  }
  for (const o of orgs) {
    const tr = document.createElement("tr");
    const cells = [o.id, o.name, (o.frontendOrigins || []).join(", ") || "—", o.apiKey, o.secret];
    cells.forEach((v, i) => {
      const td = document.createElement("td");
      if (i >= 2) td.className = "hide-sm";
      const c = document.createElement("code"); c.textContent = v; td.appendChild(c);
      tr.appendChild(td);
    });
    const tdm = document.createElement("td");
    const tag = document.createElement("span"); tag.className = "tag"; tag.textContent = meetingLabel(o.roomConfig);
    tdm.appendChild(tag); tr.appendChild(tdm);
    const tda = document.createElement("td"); tda.style.whiteSpace = "nowrap";
    const edit = document.createElement("button"); edit.className = "link"; edit.textContent = "Edit";
    edit.onclick = () => fill(o);
    tda.append(edit); tr.appendChild(tda);
    rows.appendChild(tr);
  }
}

function fill(o) {
  $("formTitle").textContent = "Edit " + o.id;
  $("id").value = o.id; $("id").readOnly = true;
  $("name").value = o.name; $("apiKey").value = o.apiKey; $("secret").value = "";
  $("secretHint").textContent = "Leave blank to keep the stored secret (" + o.secret + ").";
  $("webhookUrl").value = o.webhookUrl;
  $("frontendOrigins").value = (o.frontendOrigins || []).join(", ");
  $("frontendDomain").value = o.frontendDomain || "";
  $("roomConfig").value = JSON.stringify(o.roomConfig || {}, null, 2);
  $("preset").value = ""; setMsg("");
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

function reset() {
  $("form").reset(); $("id").readOnly = false;
  $("formTitle").textContent = "Add organisation";
  $("secretHint").textContent = "Required for a new org.";
  $("roomConfig").value = "{}"; setMsg("");
}

async function load() {
  try { const d = await api(BASE + "/api/orgs"); orgs = d.orgs; presets = d.presets; render(); }
  catch (e) { $("rows").innerHTML = ""; setMsg(e.message, "err"); }
}

$("preset").onchange = (e) => {
  if (e.target.value in presets) $("roomConfig").value = JSON.stringify(presets[e.target.value], null, 2);
};
$("clearBtn").onclick = reset;
$("form").onsubmit = async (e) => {
  e.preventDefault();
  let roomConfig;
  try { roomConfig = JSON.parse($("roomConfig").value || "{}"); }
  catch { setMsg("Create-meeting config is not valid JSON", "err"); return; }
  setMsg("Saving…");
  try {
    const d = await api(BASE + "/api/orgs", {
      id: $("id").value.trim(), name: $("name").value, apiKey: $("apiKey").value,
      secret: $("secret").value, webhookUrl: $("webhookUrl").value,
      frontendOrigins: $("frontendOrigins").value, frontendDomain: $("frontendDomain").value, roomConfig,
    });
    reset(); setMsg("Saved " + d.org.id, "ok"); load();
  } catch (err) { setMsg(err.message, "err"); }
};
load();

// ---- Tabs ----
function showTab(name) {
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === name));
  $("tab-orgs").hidden = name !== "orgs";
  $("tab-builds").hidden = name !== "builds";
  if (name === "builds") loadBuilds();
}
document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => showTab(b.dataset.tab));

// ---- Frontend builds ----
let maxZipBytes = 20 * 1024 * 1024;
const mb = (n) => (n / 1024 / 1024).toFixed(1) + " MB";

function cell(tr, content, cls) {
  const td = document.createElement("td");
  if (cls) td.className = cls;
  if (typeof content === "string") td.textContent = content; else if (content) td.append(...[].concat(content));
  tr.appendChild(td); return td;
}

function lastBuildText(b) {
  if (!b) return "—";
  return new Date(b.uploadedAt).toLocaleString() + " · " + b.files + " files · " + mb(b.zipBytes) + (b.forced ? " · org check skipped" : "");
}

async function loadBuilds() {
  const rows = $("siteRows");
  let d;
  try { d = await api(BASE + "/api/builds"); }
  catch (e) { rows.innerHTML = ""; const tr = document.createElement("tr"); cell(tr, e.message).colSpan = 4; rows.appendChild(tr); return; }
  maxZipBytes = d.maxZipBytes; $("maxZip").textContent = Math.round(maxZipBytes / 1024 / 1024);
  rows.textContent = "";
  if (!d.sites.length) { const tr = document.createElement("tr"); cell(tr, "No organisations yet.").colSpan = 4; rows.appendChild(tr); return; }
  for (const s of d.sites) {
    const tr = document.createElement("tr"); tr.className = "site";
    const name = document.createElement("div"); name.textContent = s.name;
    const id = document.createElement("code"); id.textContent = s.id;
    cell(tr, [name, id]);
    if (s.domain) {
      const a = document.createElement("a"); a.href = "https://" + s.domain + "/"; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = s.domain;
      cell(tr, a);
    } else cell(tr, "—");
    const last = cell(tr, lastBuildText(s.lastBuild), "hide-sm");
    const td = cell(tr, null);
    if (!s.domain) { td.innerHTML = '<span class="hint">Set a frontend domain in Organisations</span>'; rows.appendChild(tr); continue; }
    if (!s.siteExists) { td.innerHTML = '<span class="hint">Site not set up on the server yet</span>'; rows.appendChild(tr); continue; }
    const file = document.createElement("input"); file.type = "file"; file.accept = ".zip,application/zip";
    const force = document.createElement("input"); force.type = "checkbox";
    const forceLbl = document.createElement("label"); forceLbl.className = "inline hint"; forceLbl.append(force, "skip org check");
    const btn = document.createElement("button"); btn.className = "primary"; btn.textContent = "Upload";
    const msg = document.createElement("span"); msg.className = "bmsg";
    const row = document.createElement("div"); row.className = "row"; row.append(file, forceLbl, btn);
    td.append(row, msg);
    btn.onclick = () => upload(s, file, force, btn, msg, last);
    rows.appendChild(tr);
  }
}

function upload(site, file, force, btn, msg, last) {
  const f = file.files[0];
  const say = (t, k) => { msg.textContent = t; msg.className = "bmsg" + (k ? " " + k : ""); };
  if (!f) return say("Choose a .zip file", "err");
  if (!f.name.toLowerCase().endsWith(".zip")) return say("Only .zip files", "err");
  if (f.size > maxZipBytes) return say("Zip is " + mb(f.size) + " — max is " + mb(maxZipBytes), "err");
  if (!confirm("Replace the live site " + site.domain + " with " + f.name + "?")) return;
  const fd = new FormData(); fd.append("file", f); if (force.checked) fd.append("force", "1");
  const xhr = new XMLHttpRequest();
  xhr.open("POST", BASE + "/api/orgs/" + encodeURIComponent(site.id) + "/build");
  xhr.setRequestHeader("X-Admin-Upload", "1");
  xhr.upload.onprogress = (e) => { if (e.lengthComputable) say("Uploading… " + Math.round(e.loaded / e.total * 100) + "%"); };
  xhr.upload.onload = () => say("Deploying…");
  xhr.onload = () => {
    btn.disabled = false;
    let d = {}; try { d = JSON.parse(xhr.responseText); } catch {}
    if (xhr.status === 413) return say("Zip is too large for the server", "err");
    if (xhr.status !== 200) return say(d.message || ("Upload failed: " + xhr.status), "err");
    say("Live on " + site.domain + " · " + d.build.files + " files", "ok");
    last.textContent = lastBuildText(d.build); file.value = ""; force.checked = false;
  };
  xhr.onerror = () => { btn.disabled = false; say("Network error", "err"); };
  btn.disabled = true; say("Uploading… 0%"); xhr.send(fd);
}
</script>
</body>
</html>
"""
