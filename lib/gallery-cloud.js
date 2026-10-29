const fs = require("fs");
const path = require("path");

const TYPES = { ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

function readEnvFile() {
  const env = {};
  const file = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function cloudConfig() {
  const env = { ...readEnvFile(), ...process.env };
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE || env.SUPABASE_ANON_KEY || "";
  return { url, key, secret: Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE) };
}

async function rest(method, table, { query = "", body, prefer } = {}) {
  const { url, key } = cloudConfig();
  if (!url || !key) throw new Error("Supabase n'est pas configuré");
  const response = await fetch(`${url}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (error) { data = { message: text.slice(0, 180) }; }
  }
  if (!response.ok) throw new Error((data && data.message) || `Supabase ${response.status}`);
  return data;
}

function galleryRow(gallery) {
  return {
    id: gallery.id,
    code: gallery.code,
    client_name: gallery.clientName,
    email: gallery.email || "",
    session_date: gallery.date || null,
    max_photos: gallery.maxPhotos,
    password_salt: gallery.salt,
    password_hash: gallery.hash,
    selection_photo_ids: (gallery.selection && gallery.selection.photoIds) || [],
    selection_submitted_at: (gallery.selection && gallery.selection.submittedAt) || null,
  };
}

async function uploadPhoto(galleryId, photo, file) {
  const { url, key } = cloudConfig();
  const preview = path.join(path.dirname(file), `${photo.id}.preview.jpg`);
  if (!fs.existsSync(preview)) throw new Error("Aperçu protégé manquant");
  const response = await fetch(`${url}/storage/v1/object/private-galleries/${galleryId}/${photo.id}${photo.ext}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true",
    },
    body: fs.readFileSync(preview),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text.slice(0, 180) || `Photo Supabase ${response.status}`);
  }
}

async function pushGallery(root, gallery) {
  const { url, key } = cloudConfig();
  if (!url || !key) return false;
  await rest("POST", "galleries", {
    query: "?on_conflict=id",
    prefer: "resolution=merge-duplicates",
    body: galleryRow(gallery),
  });
  const photos = gallery.photos || [];
  if (photos.length) {
    await rest("POST", "gallery_photos", {
      query: "?on_conflict=id",
      prefer: "resolution=merge-duplicates",
      body: photos.map((photo, position) => ({
        id: photo.id,
        gallery_id: gallery.id,
        filename: photo.filename || "photo",
        ext: photo.ext,
        position,
      })),
    });
  }
  const ids = photos.map((photo) => photo.id).filter(Boolean);
  const exclude = ids.length ? `&id=not.in.(${ids.join(",")})` : "";
  await rest("DELETE", "gallery_photos", { query: `?gallery_id=eq.${gallery.id}${exclude}` });
  for (const photo of photos) {
    if (!/^[a-f0-9]{16}$/.test(photo.id) || !TYPES[photo.ext]) continue;
    const file = path.join(root, "private-galleries", gallery.id, photo.id + photo.ext);
    if (fs.existsSync(file)) await uploadPhoto(gallery.id, photo, file);
  }
  return true;
}

async function deleteRemoteGallery(gallery) {
  const { url, key } = cloudConfig();
  if (!url || !key || !gallery) return false;
  await rest("DELETE", "galleries", { query: `?id=eq.${gallery.id}` });
  for (const photo of gallery.photos || []) {
    await fetch(`${url}/storage/v1/object/private-galleries/${gallery.id}/${photo.id}${photo.ext}`, {
      method: "DELETE",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
  }
  return true;
}

async function pullGallery(id) {
  const { url, key } = cloudConfig();
  if (!url || !key) return null;
  const rows = await rest("GET", "galleries", { query: `?id=eq.${id}&select=selection_photo_ids,selection_submitted_at` });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    selection: {
      photoIds: row.selection_photo_ids || [],
      submittedAt: row.selection_submitted_at || null,
    },
  };
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

async function listGalleries() {
  const rows = await rest("GET", "galleries", {
    query: "?select=*,gallery_photos(id,filename,ext,position)&order=created_at.desc",
  });
  return (Array.isArray(rows) ? rows : []).map(fromRow);
}

async function storageRequest(method, objectPath, { body, contentType } = {}) {
  const { url, key } = cloudConfig();
  const response = await fetch(`${url}/storage/v1/${objectPath}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(method === "POST" || method === "PUT" ? { "x-upsert": "true" } : {}),
    },
    body,
  });
  return response;
}

async function uploadBytes(bucket, objectPath, bytes, contentType) {
  const response = await storageRequest("POST", `object/${bucket}/${objectPath}`, { body: bytes, contentType });
  if (!response.ok) throw new Error((await response.text()).slice(0, 180) || "Envoi de la photo impossible");
}

async function downloadBytes(bucket, objectPath) {
  const response = await storageRequest("GET", `object/${bucket}/${objectPath}`);
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) throw new Error("Photo introuvable");
  return Buffer.from(await response.arrayBuffer());
}

async function deleteBytes(bucket, objectPath) {
  await storageRequest("DELETE", `object/${bucket}/${objectPath}`);
}

module.exports = {
  cloudConfig,
  rest,
  pushGallery,
  deleteRemoteGallery,
  pullGallery,
  fromRow,
  listGalleries,
  uploadBytes,
  downloadBytes,
  deleteBytes,
};
