const crypto = require("crypto");
const { checkGalleryPassword, slugify, clientView } = require("../../lib/gallery-auth.js");
const { cloudConfig, rest } = require("../../lib/gallery-cloud.js");

const TYPES = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function reply(status, payload, extra = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extra,
    },
    body: JSON.stringify(payload),
  };
}

function cookieHeader(event) {
  const headers = event.headers || {};
  return headers.cookie || headers.Cookie || "";
}

function clientToken(event) {
  const match = cookieHeader(event).match(/(?:^|;\s*)iyc_client=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function sessionCookie(token) {
  const maxAge = token ? Math.floor(SESSION_MS / 1000) : 0;
  return `iyc_client=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function readToken(token, secret) {
  if (!secret || !token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload || payload.exp < Date.now()) return null;
  return payload;
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return raw ? JSON.parse(raw) : {};
}

function fromRow(row) {
  const photos = (row.gallery_photos || []).slice().sort((a, b) => a.position - b.position);
  return {
    id: row.id,
    code: row.code,
    clientName: row.client_name,
    email: row.email || "",
    date: row.session_date,
    maxPhotos: row.max_photos,
    salt: row.password_salt,
    hash: row.password_hash,
    photos: photos.map((photo) => ({ id: photo.id, filename: photo.filename, ext: photo.ext })),
    selection: {
      photoIds: row.selection_photo_ids || [],
      submittedAt: row.selection_submitted_at || null,
    },
  };
}

async function galleryById(id) {
  const rows = await rest("GET", "galleries", {
    query: `?id=eq.${encodeURIComponent(id)}&select=*,gallery_photos(id,filename,ext,position)`,
  });
  return Array.isArray(rows) && rows[0] ? fromRow(rows[0]) : null;
}

exports.handler = async (event) => {
  try {
    const { url, key, secret } = cloudConfig();
    if (!url || !key) return reply(503, { error: "Supabase n'est pas configuré sur Netlify." });
    if (!secret) return reply(503, { error: "La clé secrète Supabase manque dans les réglages Netlify." });
    const pathname = new URL(event.rawUrl || "https://iyc-studio.netlify.app" + event.path).pathname.replace(/^\/\.netlify\/functions\/client/, "/api/client");
    if (event.httpMethod === "POST" && pathname === "/api/client/login") {
      const body = readBody(event);
      const code = slugify(body.code || "");
      const rows = code
        ? await rest("GET", "galleries", { query: `?code=eq.${encodeURIComponent(code)}&select=*,gallery_photos(id,filename,ext,position)` })
        : [];
      const gallery = Array.isArray(rows) && rows[0] ? fromRow(rows[0]) : null;
      if (!gallery || !checkGalleryPassword(gallery, body.password)) {
        return reply(401, { error: "Code ou mot de passe incorrect" });
      }
      const token = sign({ id: gallery.id, exp: Date.now() + SESSION_MS }, key);
      return reply(200, { ok: true, gallery: clientView(gallery) }, { "Set-Cookie": sessionCookie(token) });
    }
    const session = readToken(clientToken(event), key);
    if (event.httpMethod === "POST" && pathname === "/api/client/logout") {
      return reply(200, { ok: true }, { "Set-Cookie": sessionCookie("") });
    }
    if (event.httpMethod === "GET" && pathname === "/api/client/me") {
      const gallery = session ? await galleryById(session.id) : null;
      return reply(200, { gallery: gallery ? clientView(gallery) : null });
    }
    const photoMatch = pathname.match(/^\/api\/client\/photo\/([a-f0-9]{16})$/);
    if (event.httpMethod === "GET" && photoMatch) {
      const gallery = session ? await galleryById(session.id) : null;
      const photo = gallery && gallery.photos.find((item) => item.id === photoMatch[1]);
      if (!photo || !TYPES[photo.ext]) return reply(401, { error: "Connexion requise" });
      const file = await fetch(`${url}/storage/v1/object/private-galleries/${gallery.id}/${photo.id}${photo.ext}`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!file.ok) return reply(404, { error: "Photo introuvable" });
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        statusCode: 200,
        headers: { "Content-Type": TYPES[photo.ext], "Cache-Control": "private, no-store" },
        body: bytes.toString("base64"),
        isBase64Encoded: true,
      };
    }
    if (event.httpMethod === "POST" && pathname === "/api/client/selection") {
      const gallery = session ? await galleryById(session.id) : null;
      if (!gallery) return reply(401, { error: "Connexion requise" });
      if (gallery.selection.submittedAt) return reply(400, { error: "La sélection est déjà validée" });
      const body = readBody(event);
      const ids = [...new Set(Array.isArray(body.photoIds) ? body.photoIds.map(String) : [])];
      const known = new Set(gallery.photos.map((photo) => photo.id));
      if (!ids.length || ids.some((id) => !known.has(id))) return reply(400, { error: "Sélection invalide" });
      if (ids.length > gallery.maxPhotos) return reply(400, { error: `Maximum ${gallery.maxPhotos} photos` });
      const submittedAt = new Date().toISOString();
      await rest("PATCH", "galleries", {
        query: `?id=eq.${gallery.id}`,
        body: { selection_photo_ids: ids, selection_submitted_at: submittedAt },
      });
      gallery.selection = { photoIds: ids, submittedAt };
      return reply(200, { ok: true, gallery: clientView(gallery) });
    }
    return reply(404, { error: "Route inconnue" });
  } catch (error) {
    return reply(500, { error: error.message || "Erreur" });
  }
};
