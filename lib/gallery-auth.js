const crypto = require("crypto");

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function checkGalleryPassword(gallery, password) {
  if (!gallery || !gallery.hash || !gallery.salt) return false;
  const hash = hashPassword(password || "", gallery.salt);
  const left = Buffer.from(hash);
  const right = Buffer.from(gallery.hash);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function clientView(gallery) {
  return {
    code: gallery.code,
    clientName: gallery.clientName,
    sessionDate: gallery.date,
    maxPhotos: gallery.maxPhotos,
    locked: Boolean(gallery.selection && gallery.selection.submittedAt),
    selectedPhotos: (gallery.selection && gallery.selection.photoIds) || [],
    photos: (gallery.photos || []).map((photo, index) => ({
      id: photo.id,
      filename: photo.filename,
      number: String(index + 1).padStart(3, "0"),
      url: `/api/client/photo/${photo.id}`,
      thumbnail: `/api/client/photo/${photo.id}`,
    })),
  };
}

module.exports = { slugify, hashPassword, checkGalleryPassword, clientView };
