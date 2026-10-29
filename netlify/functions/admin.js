const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { hashPassword, slugify } = require("../../lib/gallery-auth");
const {
  cloudConfig,
  pushGallery,
  deleteRemoteGallery,
  listGalleries,
  uploadBytes,
  downloadBytes,
  deleteBytes,
} = require("../../lib/gallery-cloud");
const { ensureBuckets, getJson, putJson, publicImageUrl, listPublicImages, ORIGINAL_BUCKET } = require("../../lib/site-store");
const { blogImages } = require("../../lib/render");

const SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const IMAGE_TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };

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

function requestPath(event) {
  const raw = new URL(event.rawUrl || "https://boisseriejimmy.com/").pathname;
  return raw.replace(/^\/\.netlify\/functions\/admin/, "") || "/";
}

function readBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  return raw ? JSON.parse(raw) : {};
}

function cookieHeader(event) {
  const headers = event.headers || {};
  return headers.cookie || headers.Cookie || "";
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
  if (!payload || payload.role !== "admin" || payload.exp < Date.now()) return null;
  return payload;
}

function adminCookie(token) {
  const maxAge = token ? Math.floor(SESSION_MS / 1000) : 0;
  return `iyc_admin=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function adminToken(event) {
  const match = cookieHeader(event).match(/(?:^|;\s*)iyc_admin=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function passwordsMatch(password, auth) {
  if (!auth || !auth.salt || !auth.hash) return false;
  const hash = hashPassword(password || "", auth.salt);
  const left = Buffer.from(hash);
  const right = Buffer.from(auth.hash);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function coverFocus(value) {
  const match = String(value || "").match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return "50% 50%";
  const axis = (part) => Math.min(100, Math.max(0, Math.round(Number(part))));
  return `${axis(match[1])}% ${axis(match[2])}%`;
}

function normalizeProject(input, previous) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Le projet a besoin d'un titre");
  const slug = slugify(input.slug || title);
  const photos = [...new Set((input.photos || []).map((src) => String(src).replace(/^\.\.\//, "")))];
  const cover = input.cover ? String(input.cover).replace(/^\.\.\//, "") : photos[0] || "";
  if (cover && !photos.includes(cover)) photos.unshift(cover);
  return {
    id: (previous && previous.id) || slug || crypto.randomBytes(4).toString("hex"),
    slug,
    title,
    category: String(input.category || "Projet").trim(),
    location: String(input.location || "").trim(),
    year: String(input.year || "").trim(),
    excerpt: String(input.excerpt || "").trim(),
    story: Array.isArray(input.story) ? input.story.map((item) => String(item).trim()).filter(Boolean) : String(input.story || "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
    cover,
    coverPosition: coverFocus(input.coverPosition),
    textColor: input.textColor === "black" ? "black" : "white",
    photos,
  };
}

function normalizePost(input, previous) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("L'article a besoin d'un titre");
  const slug = slugify(input.slug || title);
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  return {
    id: (previous && previous.id) || slug,
    slug,
    title,
    date: input.date || new Date().toISOString().slice(0, 10),
    dateLabel: input.dateLabel || input.date || "",
    minutes: String(input.minutes || "").trim(),
    excerpt: String(input.excerpt || "").trim(),
    cover: input.cover ? String(input.cover).replace(/^\.\.\//, "") : "",
    blocks: blocks.map((block) => {
      if (block.type === "list" && typeof block.items === "string") {
        return { ...block, items: block.items.split("\n").map((item) => item.trim()).filter(Boolean) };
      }
      return block;
    }),
  };
}

function normalizeGallery(input, previous) {
  const clientName = String(input.clientName || "").trim();
  if (!clientName) throw new Error("Le client a besoin d'un nom");
  const code = slugify(input.code || clientName);
  if (!code) throw new Error("Le code d'accès est invalide");
  const email = String(input.email || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Adresse e-mail invalide");
  const maxPhotos = Math.min(500, Math.max(1, Number(input.maxPhotos) || 10));
  const next = {
    id: (previous && previous.id) || crypto.randomBytes(6).toString("hex"),
    code,
    clientName,
    email,
    date: String(input.date || (previous && previous.date) || new Date().toISOString().slice(0, 10)),
    maxPhotos,
    salt: (previous && previous.salt) || crypto.randomBytes(16).toString("hex"),
    hash: (previous && previous.hash) || "",
    photos: (previous && previous.photos) || [],
    selection: (previous && previous.selection) || { photoIds: [], submittedAt: null },
  };
  if (input.password) {
    if (String(input.password).length < 6) throw new Error("6 caractères minimum pour le mot de passe du client");
    next.salt = crypto.randomBytes(16).toString("hex");
    next.hash = hashPassword(String(input.password), next.salt);
  } else if (!previous) {
    throw new Error("Choisis un mot de passe pour le client");
  }
  return next;
}

function adminView(gallery) {
  const selected = new Set((gallery.selection && gallery.selection.photoIds) || []);
  return {
    id: gallery.id,
    code: gallery.code,
    clientName: gallery.clientName,
    email: gallery.email || "",
    date: gallery.date,
    maxPhotos: gallery.maxPhotos,
    photos: (gallery.photos || []).map((photo) => ({
      id: photo.id,
      filename: photo.filename,
      selected: selected.has(photo.id),
    })),
    selection: {
      photoIds: (gallery.selection && gallery.selection.photoIds) || [],
      submittedAt: (gallery.selection && gallery.selection.submittedAt) || null,
    },
  };
}

function decodeImage(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Image non reconnue");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 20 || buffer.length > 8 * 1024 * 1024) throw new Error("Image trop lourde ou vide");
  return { type: match[1], ext: IMAGE_TYPES[match[1]], buffer };
}

function readPack(name, fallbackFile) {
  return getJson(name).then((value) => {
    if (value) return value;
    const candidates = [
      path.join(process.cwd(), "data", fallbackFile),
      path.join(__dirname, "data", fallbackFile),
      path.join(__dirname, "..", "..", "data", fallbackFile),
    ];
    const file = candidates.find((item) => fs.existsSync(item));
    if (!file) return name === "posts.json" ? { posts: [] } : { projects: [] };
    return JSON.parse(fs.readFileSync(file, "utf8"));
  });
}

function staticLibrary() {
  const candidates = [
    path.join(process.cwd(), "data", "library.json"),
    path.join(__dirname, "data", "library.json"),
    path.join(__dirname, "..", "..", "data", "library.json"),
  ];
  const file = candidates.find((item) => fs.existsSync(item));
  if (!file) return [];
  const names = JSON.parse(fs.readFileSync(file, "utf8"));
  return Array.isArray(names) ? names : [];
}

async function contentPayload() {
  const [portfolio, postsFile, galleries, uploaded] = await Promise.all([
    readPack("portfolio.json", "portfolio.json"),
    readPack("posts.json", "posts.json"),
    listGalleries(),
    listPublicImages().catch(() => []),
  ]);
  const projects = portfolio.projects || [];
  const posts = postsFile.posts || [];
  const reserved = blogImages(posts);
  const usage = {};
  for (const project of projects) {
    for (const src of [project.cover, ...(project.photos || [])]) {
      if (!src) continue;
      const name = path.basename(src.split("?")[0]);
      usage[name] = usage[name] || [];
      if (!usage[name].includes(project.title)) usage[name].push(project.title);
    }
  }
  const seen = new Set();
  const library = [];
  const push = (src) => {
    const name = path.basename(String(src).split("?")[0]);
    if (!name || seen.has(name) || name.startsWith("tableau-comparatif") || name === "fichier-1-300x-AoPvowXDj1U242O6.png") return;
    seen.add(name);
    library.push({ src, blog: reserved.has(name), projects: usage[name] || [] });
  };
  staticLibrary().forEach((name) => push(`images/${name}`));
  uploaded.forEach(push);
  library.sort((a, b) => path.basename(a.src).localeCompare(path.basename(b.src)));
  return { projects, posts, galleries: galleries.map(adminView), library };
}

function assertNoBlogPhotos(projects, posts) {
  const reserved = blogImages(posts);
  for (const project of projects) {
    const files = [project.cover, ...(project.photos || [])].filter(Boolean).map((src) => path.basename(String(src).split("?")[0]));
    const clash = files.find((file) => reserved.has(file));
    if (clash) throw new Error(`La photo ${clash} est utilisée dans le blog. Elle ne peut pas aller dans le portfolio.`);
  }
}

async function savePortfolio(portfolio) {
  await putJson("portfolio.json", portfolio);
}

async function savePosts(postsFile) {
  await putJson("posts.json", postsFile);
}

exports.handler = async (event) => {
  try {
    const { key, secret } = cloudConfig();
    if (!key || !secret) return reply(503, { error: "Supabase n'est pas configuré sur Netlify." });
    await ensureBuckets();
    const pathname = requestPath(event);
    const method = event.httpMethod;
    const authed = Boolean(readToken(adminToken(event), key));

    if (method === "POST" && pathname === "/api/login") {
      const body = readBody(event);
      const auth = await getJson("auth.json");
      if (!auth) return reply(503, { error: "Le mot de passe du tableau de bord n'est pas encore enregistré." });
      if (!passwordsMatch(body.password, auth)) return reply(401, { error: "Mot de passe incorrect" });
      const token = sign({ role: "admin", exp: Date.now() + SESSION_MS }, key);
      return reply(200, { ok: true }, { "Set-Cookie": adminCookie(token) });
    }
    if (method === "POST" && pathname === "/api/logout") {
      return reply(200, { ok: true }, { "Set-Cookie": adminCookie("") });
    }
    if (method === "GET" && pathname === "/api/me") {
      return reply(200, { ok: authed });
    }
    if (!authed) return reply(401, { error: "Connexion requise" });

    if (method === "GET" && pathname === "/api/content") {
      return reply(200, await contentPayload());
    }

    if (method === "POST" && pathname === "/api/upload") {
      const body = readBody(event);
      const image = decodeImage(body.dataUrl);
      const name = `${crypto.randomBytes(8).toString("hex")}${image.ext}`;
      await uploadBytes("site-images", name, image.buffer, image.type);
      return reply(200, { src: publicImageUrl(name) });
    }

    if (method === "POST" && pathname === "/api/password") {
      const body = readBody(event);
      const auth = await getJson("auth.json");
      if (!passwordsMatch(body.current, auth)) return reply(401, { error: "Mot de passe actuel incorrect" });
      if (!body.next || String(body.next).length < 8) return reply(400, { error: "8 caractères minimum" });
      const salt = crypto.randomBytes(16).toString("hex");
      await putJson("auth.json", { salt, hash: hashPassword(String(body.next), salt) });
      return reply(200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/galleries") {
      const gallery = normalizeGallery(readBody(event));
      const galleries = await listGalleries();
      if (galleries.some((item) => item.code === gallery.code)) throw new Error("Ce code d'accès est déjà utilisé");
      await pushGallery(process.cwd(), gallery);
      return reply(200, adminView(gallery));
    }

    const originalMatch = pathname.match(/^\/api\/galleries\/([a-f0-9]+)\/photos\/([a-f0-9]{16})\/original$/);
    if (originalMatch && method === "POST") {
      const image = decodeImage(readBody(event).dataUrl);
      await uploadBytes(ORIGINAL_BUCKET, `${originalMatch[1]}/${originalMatch[2]}.jpg`, image.buffer, "image/jpeg");
      return reply(200, { ok: true });
    }

    const galleryPhotoMatch = pathname.match(/^\/api\/galleries\/([a-f0-9]+)\/photos\/([a-f0-9]{16})$/);
    if (galleryPhotoMatch && method === "GET") {
      const galleries = await listGalleries();
      const gallery = galleries.find((item) => item.id === galleryPhotoMatch[1]);
      const photo = gallery && gallery.photos.find((item) => item.id === galleryPhotoMatch[2]);
      if (!photo) return reply(404, { error: "Photo introuvable" });
      const original = await downloadBytes(ORIGINAL_BUCKET, `${gallery.id}/${photo.id}.jpg`);
      const bytes = original || await downloadBytes("private-galleries", `${gallery.id}/${photo.id}${photo.ext}`);
      if (!bytes) return reply(404, { error: "Photo introuvable" });
      return {
        statusCode: 200,
        headers: { "Content-Type": original ? "image/jpeg" : "image/jpeg", "Cache-Control": "private, no-store" },
        body: bytes.toString("base64"),
        isBase64Encoded: true,
      };
    }
    if (galleryPhotoMatch && method === "DELETE") {
      const galleries = await listGalleries();
      const gallery = galleries.find((item) => item.id === galleryPhotoMatch[1]);
      if (!gallery) return reply(404, { error: "Galerie introuvable" });
      const photo = gallery.photos.find((item) => item.id === galleryPhotoMatch[2]);
      gallery.photos = gallery.photos.filter((item) => item.id !== galleryPhotoMatch[2]);
      if (gallery.selection) gallery.selection.photoIds = gallery.selection.photoIds.filter((id) => id !== galleryPhotoMatch[2]);
      if (photo) await deleteBytes("private-galleries", `${gallery.id}/${photo.id}${photo.ext}`);
      await deleteBytes(ORIGINAL_BUCKET, `${gallery.id}/${galleryPhotoMatch[2]}.jpg`);
      await pushGallery(process.cwd(), gallery);
      return reply(200, adminView(gallery));
    }

    const galleryPhotosMatch = pathname.match(/^\/api\/galleries\/([a-f0-9]+)\/photos$/);
    if (galleryPhotosMatch && method === "POST") {
      const body = readBody(event);
      const galleries = await listGalleries();
      const gallery = galleries.find((item) => item.id === galleryPhotosMatch[1]);
      if (!gallery) return reply(404, { error: "Galerie introuvable" });
      const image = decodeImage(body.dataUrl);
      const id = crypto.randomBytes(8).toString("hex");
      const photo = { id, ext: ".jpg", filename: path.basename(body.name || "photo").replace(/\.[^.]+$/, "") };
      await uploadBytes("private-galleries", `${gallery.id}/${id}.jpg`, image.buffer, "image/jpeg");
      gallery.photos.push(photo);
      await pushGallery(process.cwd(), gallery);
      return reply(200, adminView(gallery));
    }

    const galleryMatch = pathname.match(/^\/api\/galleries\/([a-f0-9]+)$/);
    if (galleryMatch && method === "PUT") {
      const galleries = await listGalleries();
      const previous = galleries.find((item) => item.id === galleryMatch[1]);
      if (!previous) return reply(404, { error: "Galerie introuvable" });
      const gallery = normalizeGallery(readBody(event), previous);
      if (galleries.some((item) => item.code === gallery.code && item.id !== gallery.id)) throw new Error("Ce code d'accès est déjà utilisé");
      await pushGallery(process.cwd(), gallery);
      return reply(200, adminView(gallery));
    }
    if (galleryMatch && method === "DELETE") {
      const galleries = await listGalleries();
      const removed = galleries.find((item) => item.id === galleryMatch[1]);
      await deleteRemoteGallery(removed);
      if (removed) {
        for (const photo of removed.photos || []) {
          await deleteBytes(ORIGINAL_BUCKET, `${removed.id}/${photo.id}.jpg`);
        }
      }
      return reply(200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/projects") {
      const portfolio = await readPack("portfolio.json", "portfolio.json");
      const postsFile = await readPack("posts.json", "posts.json");
      const project = normalizeProject(readBody(event));
      portfolio.projects = portfolio.projects || [];
      if (portfolio.projects.some((item) => item.slug === project.slug)) throw new Error("Ce lien de projet existe déjà");
      portfolio.projects.push(project);
      assertNoBlogPhotos(portfolio.projects, postsFile.posts || []);
      await savePortfolio(portfolio);
      return reply(200, project);
    }
    const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && method === "PUT") {
      const portfolio = await readPack("portfolio.json", "portfolio.json");
      const postsFile = await readPack("posts.json", "posts.json");
      const index = (portfolio.projects || []).findIndex((item) => item.id === decodeURIComponent(projectMatch[1]));
      if (index < 0) return reply(404, { error: "Projet introuvable" });
      const project = normalizeProject(readBody(event), portfolio.projects[index]);
      portfolio.projects[index] = project;
      assertNoBlogPhotos(portfolio.projects, postsFile.posts || []);
      await savePortfolio(portfolio);
      return reply(200, project);
    }
    if (projectMatch && method === "DELETE") {
      const portfolio = await readPack("portfolio.json", "portfolio.json");
      portfolio.projects = (portfolio.projects || []).filter((item) => item.id !== decodeURIComponent(projectMatch[1]));
      await savePortfolio(portfolio);
      return reply(200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/posts") {
      const postsFile = await readPack("posts.json", "posts.json");
      const post = normalizePost(readBody(event));
      postsFile.posts = postsFile.posts || [];
      if (postsFile.posts.some((item) => item.slug === post.slug)) throw new Error("Ce lien d'article existe déjà");
      postsFile.posts.push(post);
      await savePosts(postsFile);
      return reply(200, post);
    }
    const postMatch = pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (postMatch && method === "PUT") {
      const postsFile = await readPack("posts.json", "posts.json");
      const index = (postsFile.posts || []).findIndex((item) => item.id === decodeURIComponent(postMatch[1]));
      if (index < 0) return reply(404, { error: "Article introuvable" });
      const post = normalizePost(readBody(event), postsFile.posts[index]);
      postsFile.posts[index] = post;
      await savePosts(postsFile);
      return reply(200, post);
    }
    if (postMatch && method === "DELETE") {
      const postsFile = await readPack("posts.json", "posts.json");
      postsFile.posts = (postsFile.posts || []).filter((item) => item.id !== decodeURIComponent(postMatch[1]));
      await savePosts(postsFile);
      return reply(200, { ok: true });
    }

    return reply(404, { error: "Route inconnue" });
  } catch (error) {
    return reply(500, { error: error.message || "Erreur" });
  }
};
