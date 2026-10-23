const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { renderAll, blogImages } = require("./lib/render");

const ROOT = __dirname;
const PORT = process.env.PORT || 8765;
const sessions = new Set();

function readJson(name, fallback) {
  const file = path.join(ROOT, "data", name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(name, data) {
  fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data", name), JSON.stringify(data, null, 2));
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function stripTags(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function seedPosts() {
  if (fs.existsSync(path.join(ROOT, "data", "posts.json"))) return;
  const metas = [
    {
      file: "transformez-vos-photos-avec-les-presets-simplicite-et-creativite-en-un-clic.html",
      slug: "transformez-vos-photos-avec-les-presets-simplicite-et-creativite-en-un-clic",
      title: "Transformez vos photos avec les presets : simplicité et créativité en un clic",
      date: "2025-03-15",
      dateLabel: "15 mars 2025",
      minutes: "4",
      excerpt: "Découvrez comment les presets peuvent transformer votre flux de travail, et téléchargez gratuitement l'un de mes presets.",
    },
    {
      file: "maitrisez-les-bases-de-la-photographie-le-guide-pour-transformer-vos-cliches-en-chef-doeuvre.html",
      slug: "maitrisez-les-bases-de-la-photographie-le-guide-pour-transformer-vos-cliches-en-chef-doeuvre",
      title: "Maîtrisez les bases de la photographie : le guide pour transformer vos clichés en chef-d'œuvre",
      date: "2025-02-15",
      dateLabel: "15 février 2025",
      minutes: "4",
      excerpt: "Triangle d'exposition, lumière et composition : les bases pour transformer un cliché en image.",
    },
    {
      file: "3-cles-pour-decouvrir-la-photographie-en-2025-et-explorer-votre-creativite-rapidement.html",
      slug: "3-cles-pour-decouvrir-la-photographie-en-2025-et-explorer-votre-creativite-rapidement",
      title: "3 clés pour découvrir la photographie en 2025 et explorer votre créativité rapidement",
      date: "2025-01-15",
      dateLabel: "15 janvier 2025",
      minutes: "3",
      excerpt: "Trois clés simples pour maîtriser la photographie, capturer vos moments préférés et exprimer votre vision.",
    },
  ];
  const posts = metas.map((meta) => {
    const html = fs.readFileSync(path.join(ROOT, "blog", meta.file), "utf8");
    const cover = (html.match(/class="article-cover" src="\.\.\/([^"]+)"/) || [])[1] || "";
    const body = (html.match(/<div class="article-body">([\s\S]*?)<\/div>\s*<p style="margin-top:3rem">/) || [])[1] || "";
    return { id: meta.slug, ...meta, cover, blocks: parseBlocks(body) };
  });
  writeJson("posts.json", { posts });
}

function parseBlocks(html) {
  const blocks = [];
  const re = /<(h2|h3|p|ul|div|figure)\b[^>]*>[\s\S]*?<\/\1>/g;
  let match;
  while ((match = re.exec(html))) {
    const tag = match[1];
    const full = match[0];
    if (tag === "div" && full.includes("article-gallery")) {
      const images = [...full.matchAll(/src="(?:\.\.\/)?(images\/[^"]+)"/g)].map((item) => item[1]);
      blocks.push({ type: "gallery", images });
    } else if (tag === "figure") {
      const src = (full.match(/src="(?:\.\.\/)?(images\/[^"]+)"/) || [])[1];
      const caption = stripTags((full.match(/<figcaption>([\s\S]*?)<\/figcaption>/) || [])[1] || "");
      const alt = stripTags((full.match(/alt="([^"]*)"/) || [])[1] || "");
      if (src) blocks.push({ type: "image", src, alt, caption });
    } else if (tag === "h2" || tag === "h3") {
      blocks.push({ type: "heading", level: tag === "h3" ? 3 : 2, text: stripTags(full) });
    } else if (tag === "ul") {
      const items = [...full.matchAll(/<li>([\s\S]*?)<\/li>/g)]
        .map((item) => stripTags(item[1]))
        .filter((item) => item && item !== "-");
      blocks.push({ type: "list", items });
    } else if (tag === "p") {
      const inner = full.replace(/^<p[^>]*>/, "").replace(/<\/p>$/, "").trim();
      if (/^<a\b/i.test(inner) && /cta-button/.test(inner)) {
        blocks.push({
          type: "button",
          href: (inner.match(/href="([^"]+)"/) || [])[1] || "",
          label: stripTags(inner),
        });
      } else if (/<a\b/i.test(inner)) {
        blocks.push({ type: "html", html: inner });
      } else {
        const text = stripTags(inner);
        if (text) blocks.push({ type: "paragraph", text });
      }
    }
  }
  return blocks;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString("hex");
}

function ensureAuth() {
  if (fs.existsSync(path.join(ROOT, "data", "auth.json"))) return;
  const salt = crypto.randomBytes(16).toString("hex");
  writeJson("auth.json", { salt, hash: hashPassword("iyc-studio", salt) });
}

function checkPassword(password) {
  const auth = readJson("auth.json");
  const hash = hashPassword(password || "", auth.salt);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(auth.hash));
}

function cookieToken(req) {
  const header = req.headers.cookie || "";
  const match = header.match(/(?:^|;\s*)iyc_session=([^;]+)/);
  return match ? match[1] : "";
}

function isAuthed(req) {
  return sessions.has(cookieToken(req));
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 40 * 1024 * 1024) {
        reject(new Error("Fichier trop lourd"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("JSON invalide"));
      }
    });
  });
}

function saveUpload(dataUrl, originalName) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Image non reconnue");
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[match[1]];
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 20 || buffer.length > 12 * 1024 * 1024) throw new Error("Image trop lourde ou vide");
  const base = slugify(path.basename(originalName || "photo", path.extname(originalName || ""))) || "photo";
  let name = base + ext;
  let index = 2;
  while (fs.existsSync(path.join(ROOT, "images", name))) {
    name = `${base}-${index}${ext}`;
    index += 1;
  }
  fs.writeFileSync(path.join(ROOT, "images", name), buffer);
  return `images/${name}`;
}

function reservedNames() {
  return blogImages(readJson("posts.json", { posts: [] }).posts);
}

function assertNoBlogPhotos(projects) {
  const reserved = reservedNames();
  for (const project of projects) {
    const files = [project.cover, ...(project.photos || [])].filter(Boolean).map((src) => path.basename(src));
    const clash = files.find((file) => reserved.has(file));
    if (clash) {
      throw new Error(`La photo ${clash} est utilisée dans le blog. Elle ne peut pas aller dans le portfolio.`);
    }
  }
}

function publish() {
  renderAll(ROOT);
}

const clientSessions = new Map();
const clientAttempts = new Map();

function ensureGalleries() {
  fs.mkdirSync(path.join(ROOT, "private-galleries"), { recursive: true });
  if (!fs.existsSync(path.join(ROOT, "data", "galleries.json"))) writeJson("galleries.json", { galleries: [] });
}

function readGalleries() {
  return readJson("galleries.json", { galleries: [] });
}

function clientView(gallery) {
  return {
    code: gallery.code,
    clientName: gallery.clientName,
    sessionDate: gallery.date,
    maxPhotos: gallery.maxPhotos,
    locked: Boolean(gallery.selection && gallery.selection.submittedAt),
    selectedPhotos: (gallery.selection && gallery.selection.photoIds) || [],
    photos: gallery.photos.map((photo, index) => ({
      id: photo.id,
      filename: photo.filename,
      number: String(index + 1).padStart(3, "0"),
      url: `/api/client/photo/${photo.id}`,
      thumbnail: `/api/client/photo/${photo.id}`,
    })),
  };
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
    photos: gallery.photos.map((photo) => ({
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

function checkGalleryPassword(gallery, password) {
  if (!gallery.hash || !gallery.salt) return false;
  const hash = hashPassword(password || "", gallery.salt);
  const left = Buffer.from(hash);
  const right = Buffer.from(gallery.hash);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
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
    id: previous?.id || crypto.randomBytes(6).toString("hex"),
    code,
    clientName,
    email,
    date: String(input.date || previous?.date || new Date().toISOString().slice(0, 10)),
    maxPhotos,
    salt: previous?.salt || crypto.randomBytes(16).toString("hex"),
    hash: previous?.hash || "",
    photos: previous?.photos || [],
    selection: previous?.selection || { photoIds: [], submittedAt: null },
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

function assertUniqueCode(galleries, gallery) {
  if (galleries.some((item) => item.code === gallery.code && item.id !== gallery.id)) {
    throw new Error("Ce code d'accès est déjà utilisé");
  }
}

function savePrivatePhoto(galleryId, dataUrl, originalName) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Image non reconnue");
  const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[match[1]];
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 20 || buffer.length > 12 * 1024 * 1024) throw new Error("Image trop lourde ou vide");
  const id = crypto.randomBytes(8).toString("hex");
  const dir = path.join(ROOT, "private-galleries", galleryId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ext), buffer);
  return { id, ext, filename: path.basename(originalName || "photo") };
}

function privatePhotoPath(gallery, photoId) {
  if (!/^[a-f0-9]{16}$/.test(photoId) || !/^[a-f0-9]+$/.test(gallery.id)) return null;
  const photo = gallery.photos.find((item) => item.id === photoId);
  if (!photo || ![".jpg", ".png", ".webp", ".gif"].includes(photo.ext)) return null;
  const filePath = path.join(ROOT, "private-galleries", gallery.id, photoId + photo.ext);
  const root = path.join(ROOT, "private-galleries");
  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) return null;
  return filePath;
}

function streamFile(res, filePath) {
  const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };
  res.writeHead(200, {
    "Content-Type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "private, no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function clientCookie(req) {
  const match = (req.headers.cookie || "").match(/(?:^|;\s*)iyc_client=([^;]+)/);
  return match ? match[1] : "";
}

function galleryFromClient(req) {
  const token = clientCookie(req);
  const session = clientSessions.get(token);
  if (!session || session.expires < Date.now()) {
    clientSessions.delete(token);
    return null;
  }
  return readGalleries().galleries.find((item) => item.id === session.galleryId) || null;
}

function tooManyAttempts(code) {
  const entry = clientAttempts.get(code);
  return Boolean(entry && entry.until > Date.now());
}

function registerFailure(code) {
  const now = Date.now();
  const entry = clientAttempts.get(code) || { count: 0, until: 0 };
  if (entry.until && entry.until < now) {
    entry.count = 0;
    entry.until = 0;
  }
  entry.count += 1;
  if (entry.count >= 8) entry.until = now + 15 * 60 * 1000;
  clientAttempts.set(code, entry);
}

function library() {
  const reserved = reservedNames();
  const projects = readJson("portfolio.json", { projects: [] }).projects;
  const usage = {};
  for (const project of projects) {
    for (const src of [project.cover, ...(project.photos || [])]) {
      if (!src) continue;
      const name = path.basename(src);
      usage[name] = usage[name] || [];
      if (!usage[name].includes(project.title)) usage[name].push(project.title);
    }
  }
  return fs
    .readdirSync(path.join(ROOT, "images"))
    .filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file))
    .filter((file) => !file.startsWith("tableau-comparatif") && file !== "fichier-1-300x-AoPvowXDj1U242O6.png")
    .sort()
    .map((file) => ({
      src: `images/${file}`,
      blog: reserved.has(file),
      projects: usage[file] || [],
    }));
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
    id: previous?.id || slug || crypto.randomBytes(4).toString("hex"),
    slug,
    title,
    category: String(input.category || "Projet").trim(),
    location: String(input.location || "").trim(),
    year: String(input.year || "").trim(),
    excerpt: String(input.excerpt || "").trim(),
    story: Array.isArray(input.story) ? input.story.map((item) => String(item).trim()).filter(Boolean) : String(input.story || "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
    cover,
    coverPosition: coverFocus(input.coverPosition),
    photos,
  };
}

function normalizePost(input, previous) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("L'article a besoin d'un titre");
  const slug = slugify(input.slug || title);
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  return {
    id: previous?.id || slug,
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return send(res, 200, fs.readFileSync(path.join(ROOT, "admin", "index.html")), "text/html; charset=utf-8");
    }
    const decodedPath = decodeURIComponent(url.pathname);
    if (decodedPath.startsWith("/data") || decodedPath.startsWith("/private-galleries") || decodedPath === "/server.js") {
      return send(res, 404, "Introuvable", "text/plain; charset=utf-8");
    }
    let filePath = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!filePath.startsWith(ROOT)) return send(res, 403, "Interdit", "text/plain; charset=utf-8");
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
    if (!fs.existsSync(filePath)) return send(res, 404, "Introuvable", "text/plain; charset=utf-8");
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml" };
    send(res, 200, fs.readFileSync(filePath), types[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  } catch (error) {
    send(res, 500, JSON.stringify({ error: error.message }));
  }
});

async function handleApi(req, res, url) {
  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await readBody(req);
    if (!checkPassword(body.password)) return send(res, 401, JSON.stringify({ error: "Mot de passe incorrect" }));
    const token = crypto.randomBytes(24).toString("hex");
    sessions.add(token);
    res.setHeader("Set-Cookie", `iyc_session=${token}; HttpOnly; SameSite=Lax; Path=/`);
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "POST" && url.pathname === "/api/logout") {
    sessions.delete(cookieToken(req));
    res.setHeader("Set-Cookie", "iyc_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && url.pathname === "/api/me") {
    return send(res, 200, JSON.stringify({ ok: isAuthed(req) }));
  }
  if (req.method === "POST" && url.pathname === "/api/client/login") {
    const body = await readBody(req);
    const code = slugify(body.code || "");
    if (tooManyAttempts(code)) return send(res, 429, JSON.stringify({ error: "Trop de tentatives. Réessayez dans quelques minutes." }));
    const gallery = readGalleries().galleries.find((item) => item.code === code);
    if (!gallery || !checkGalleryPassword(gallery, body.password)) {
      registerFailure(code || "inconnu");
      return send(res, 401, JSON.stringify({ error: "Code ou mot de passe incorrect" }));
    }
    clientAttempts.delete(code);
    const token = crypto.randomBytes(24).toString("hex");
    clientSessions.set(token, { galleryId: gallery.id, expires: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    res.setHeader("Set-Cookie", `iyc_client=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
    return send(res, 200, JSON.stringify({ ok: true, gallery: clientView(gallery) }));
  }
  if (req.method === "POST" && url.pathname === "/api/client/logout") {
    clientSessions.delete(clientCookie(req));
    res.setHeader("Set-Cookie", "iyc_client=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    return send(res, 200, JSON.stringify({ ok: true }));
  }
  if (req.method === "GET" && url.pathname === "/api/client/me") {
    const gallery = galleryFromClient(req);
    return send(res, 200, JSON.stringify({ gallery: gallery ? clientView(gallery) : null }));
  }
  const clientPhotoMatch = url.pathname.match(/^\/api\/client\/photo\/([a-f0-9]{16})$/);
  if (req.method === "GET" && clientPhotoMatch) {
    const gallery = galleryFromClient(req);
    const filePath = gallery && privatePhotoPath(gallery, clientPhotoMatch[1]);
    if (!filePath) return send(res, 401, JSON.stringify({ error: "Connexion requise" }));
    return streamFile(res, filePath);
  }
  if (req.method === "POST" && url.pathname === "/api/client/selection") {
    const body = await readBody(req);
    const file = readGalleries();
    const session = clientSessions.get(clientCookie(req));
    const gallery = session && file.galleries.find((item) => item.id === session.galleryId);
    if (!gallery) return send(res, 401, JSON.stringify({ error: "Connexion requise" }));
    if (gallery.selection && gallery.selection.submittedAt) return send(res, 400, JSON.stringify({ error: "La sélection est déjà validée" }));
    const ids = [...new Set(Array.isArray(body.photoIds) ? body.photoIds.map(String) : [])];
    const known = new Set(gallery.photos.map((photo) => photo.id));
    if (!ids.length || ids.some((id) => !known.has(id))) return send(res, 400, JSON.stringify({ error: "Sélection invalide" }));
    if (ids.length > gallery.maxPhotos) return send(res, 400, JSON.stringify({ error: `Maximum ${gallery.maxPhotos} photos` }));
    gallery.selection = { photoIds: ids, submittedAt: new Date().toISOString() };
    writeJson("galleries.json", file);
    return send(res, 200, JSON.stringify({ ok: true, gallery: clientView(gallery) }));
  }
  if (!isAuthed(req)) return send(res, 401, JSON.stringify({ error: "Connexion requise" }));

  if (req.method === "GET" && url.pathname === "/api/content") {
    return send(res, 200, JSON.stringify({
      projects: readJson("portfolio.json", { projects: [] }).projects,
      posts: readJson("posts.json", { posts: [] }).posts,
      library: library(),
      galleries: readGalleries().galleries.map(adminView),
    }));
  }
  if (req.method === "POST" && url.pathname === "/api/upload") {
    const body = await readBody(req);
    const src = saveUpload(body.dataUrl, body.name);
    return send(res, 200, JSON.stringify({ src }));
  }
  if (req.method === "POST" && url.pathname === "/api/password") {
    const body = await readBody(req);
    if (!checkPassword(body.current)) return send(res, 401, JSON.stringify({ error: "Mot de passe actuel incorrect" }));
    if (!body.next || String(body.next).length < 8) return send(res, 400, JSON.stringify({ error: "8 caractères minimum" }));
    const salt = crypto.randomBytes(16).toString("hex");
    writeJson("auth.json", { salt, hash: hashPassword(body.next, salt) });
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  const galleryFile = readGalleries();
  if (req.method === "POST" && url.pathname === "/api/galleries") {
    const body = await readBody(req);
    const gallery = normalizeGallery(body);
    assertUniqueCode(galleryFile.galleries, gallery);
    galleryFile.galleries.push(gallery);
    writeJson("galleries.json", galleryFile);
    return send(res, 200, JSON.stringify(adminView(gallery)));
  }
  const galleryPhotoMatch = url.pathname.match(/^\/api\/galleries\/([a-f0-9]+)\/photos\/([a-f0-9]{16})$/);
  if (galleryPhotoMatch && req.method === "GET") {
    const gallery = galleryFile.galleries.find((item) => item.id === galleryPhotoMatch[1]);
    const filePath = gallery && privatePhotoPath(gallery, galleryPhotoMatch[2]);
    if (!filePath) return send(res, 404, JSON.stringify({ error: "Photo introuvable" }));
    return streamFile(res, filePath);
  }
  if (galleryPhotoMatch && req.method === "DELETE") {
    const gallery = galleryFile.galleries.find((item) => item.id === galleryPhotoMatch[1]);
    if (!gallery) return send(res, 404, JSON.stringify({ error: "Galerie introuvable" }));
    const filePath = privatePhotoPath(gallery, galleryPhotoMatch[2]);
    if (filePath) fs.rmSync(filePath, { force: true });
    gallery.photos = gallery.photos.filter((photo) => photo.id !== galleryPhotoMatch[2]);
    if (gallery.selection) gallery.selection.photoIds = gallery.selection.photoIds.filter((id) => id !== galleryPhotoMatch[2]);
    writeJson("galleries.json", galleryFile);
    return send(res, 200, JSON.stringify(adminView(gallery)));
  }
  const galleryPhotosMatch = url.pathname.match(/^\/api\/galleries\/([a-f0-9]+)\/photos$/);
  if (galleryPhotosMatch && req.method === "POST") {
    const body = await readBody(req);
    const gallery = galleryFile.galleries.find((item) => item.id === galleryPhotosMatch[1]);
    if (!gallery) return send(res, 404, JSON.stringify({ error: "Galerie introuvable" }));
    gallery.photos.push(savePrivatePhoto(gallery.id, body.dataUrl, body.name));
    writeJson("galleries.json", galleryFile);
    return send(res, 200, JSON.stringify(adminView(gallery)));
  }
  const galleryMatch = url.pathname.match(/^\/api\/galleries\/([a-f0-9]+)$/);
  if (galleryMatch && req.method === "PUT") {
    const body = await readBody(req);
    const index = galleryFile.galleries.findIndex((item) => item.id === galleryMatch[1]);
    if (index < 0) return send(res, 404, JSON.stringify({ error: "Galerie introuvable" }));
    const gallery = normalizeGallery(body, galleryFile.galleries[index]);
    assertUniqueCode(galleryFile.galleries, gallery);
    galleryFile.galleries[index] = gallery;
    writeJson("galleries.json", galleryFile);
    return send(res, 200, JSON.stringify(adminView(gallery)));
  }
  if (galleryMatch && req.method === "DELETE") {
    galleryFile.galleries = galleryFile.galleries.filter((item) => item.id !== galleryMatch[1]);
    writeJson("galleries.json", galleryFile);
    fs.rmSync(path.join(ROOT, "private-galleries", galleryMatch[1]), { recursive: true, force: true });
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  const portfolio = readJson("portfolio.json", { projects: [] });
  const postsFile = readJson("posts.json", { posts: [] });

  if (req.method === "POST" && url.pathname === "/api/projects") {
    const body = await readBody(req);
    const project = normalizeProject(body);
    if (portfolio.projects.some((item) => item.slug === project.slug)) throw new Error("Ce lien de projet existe déjà");
    assertNoBlogPhotos([project]);
    portfolio.projects.push(project);
    writeJson("portfolio.json", portfolio);
    publish();
    return send(res, 200, JSON.stringify(project));
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === "PUT") {
    const body = await readBody(req);
    const index = portfolio.projects.findIndex((item) => item.id === projectMatch[1]);
    if (index < 0) return send(res, 404, JSON.stringify({ error: "Projet introuvable" }));
    const project = normalizeProject(body, portfolio.projects[index]);
    assertNoBlogPhotos([project]);
    portfolio.projects[index] = project;
    writeJson("portfolio.json", portfolio);
    publish();
    return send(res, 200, JSON.stringify(project));
  }
  if (projectMatch && req.method === "DELETE") {
    portfolio.projects = portfolio.projects.filter((item) => item.id !== projectMatch[1]);
    writeJson("portfolio.json", portfolio);
    publish();
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && url.pathname === "/api/posts") {
    const body = await readBody(req);
    const post = normalizePost(body);
    if (postsFile.posts.some((item) => item.slug === post.slug)) throw new Error("Ce lien d'article existe déjà");
    postsFile.posts.push(post);
    writeJson("posts.json", postsFile);
    publish();
    return send(res, 200, JSON.stringify(post));
  }
  const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
  if (postMatch && req.method === "PUT") {
    const body = await readBody(req);
    const index = postsFile.posts.findIndex((item) => item.id === decodeURIComponent(postMatch[1]));
    if (index < 0) return send(res, 404, JSON.stringify({ error: "Article introuvable" }));
    const post = normalizePost(body, postsFile.posts[index]);
    postsFile.posts[index] = post;
    writeJson("posts.json", postsFile);
    publish();
    return send(res, 200, JSON.stringify(post));
  }
  if (postMatch && req.method === "DELETE") {
    postsFile.posts = postsFile.posts.filter((item) => item.id !== decodeURIComponent(postMatch[1]));
    writeJson("posts.json", postsFile);
    publish();
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  send(res, 404, JSON.stringify({ error: "Route inconnue" }));
}

ensureAuth();
ensureGalleries();
seedPosts();
publish();
server.listen(PORT, "127.0.0.1", () => {
  console.log(`IYC Studio http://127.0.0.1:${PORT}`);
  console.log(`Tableau de bord http://127.0.0.1:${PORT}/admin`);
});
