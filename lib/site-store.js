const { cloudConfig, uploadBytes, downloadBytes } = require("./gallery-cloud");

const DATA_BUCKET = "site-data";
const IMAGE_BUCKET = "site-images";
const ORIGINAL_BUCKET = "gallery-originals";

async function ensureBucket(id, isPublic) {
  const { url, key } = cloudConfig();
  if (!url || !key) throw new Error("Supabase n'est pas configuré");
  const response = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, name: id, public: isPublic }),
  });
  if (response.ok || response.status === 409) return;
  const text = await response.text();
  if (/already exists|Duplicate/i.test(text)) return;
  throw new Error(text.slice(0, 180) || "Création du stockage impossible");
}

async function ensureBuckets() {
  await ensureBucket(DATA_BUCKET, false);
  await ensureBucket(IMAGE_BUCKET, true);
  await ensureBucket(ORIGINAL_BUCKET, false);
}

async function getJson(name) {
  const bytes = await downloadBytes(DATA_BUCKET, name);
  if (!bytes) return null;
  return JSON.parse(bytes.toString("utf8"));
}

async function putJson(name, value) {
  await ensureBuckets();
  await uploadBytes(DATA_BUCKET, name, Buffer.from(JSON.stringify(value)), "application/json");
}

function publicImageUrl(name) {
  const { url } = cloudConfig();
  return `${url}/storage/v1/object/public/${IMAGE_BUCKET}/${name}`;
}

async function listPublicImages() {
  const { url, key } = cloudConfig();
  const response = await fetch(`${url}/storage/v1/object/list/${IMAGE_BUCKET}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix: "", limit: 1000, sortBy: { column: "name", order: "asc" } }),
  });
  if (!response.ok) return [];
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => row.name)
    .filter((name) => name && /\.(jpe?g|png|webp|gif)$/i.test(name))
    .map((name) => publicImageUrl(name));
}

module.exports = {
  DATA_BUCKET,
  IMAGE_BUCKET,
  ORIGINAL_BUCKET,
  ensureBuckets,
  getJson,
  putJson,
  publicImageUrl,
  listPublicImages,
};
