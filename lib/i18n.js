const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const cache = {};

function readJson(name) {
  const candidates = [
    path.join(root, "i18n", name),
    path.join(__dirname, "i18n", name),
    path.join(process.cwd(), "i18n", name),
  ];
  const file = candidates.find((item) => fs.existsSync(item));
  if (!file) throw new Error("Traduction introuvable");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function messages(locale) {
  if (!cache[locale]) cache[locale] = readJson(`${locale}.json`);
  return cache[locale];
}

function contentMessages(locale) {
  const key = `content:${locale}`;
  if (!cache[key]) cache[key] = locale === "fr" ? {} : readJson(`content.${locale}.json`);
  return cache[key];
}

function lookup(tree, key) {
  return String(key).split(".").reduce((node, part) => (node == null ? undefined : node[part]), tree);
}

function t(locale, key) {
  const value = lookup(messages(locale), key);
  if (typeof value === "string") return value;
  if (locale !== "fr") {
    const fallback = lookup(messages("fr"), key);
    if (typeof fallback === "string") return fallback;
  }
  return key;
}

function assetPrefix(file) {
  const dir = path.posix.dirname(file);
  if (dir === ".") return "";
  return "../".repeat(dir.split("/").length);
}

function relative(fromFile, toFile) {
  const rel = path.posix.relative(path.posix.dirname(fromFile), toFile);
  return rel || ".";
}

function fileFor(locale, page) {
  return locale === "en" ? `en/${page}` : page;
}

function createContext(locale, page) {
  const file = fileFor(locale, page);
  return {
    locale,
    page,
    file,
    asset: assetPrefix(file),
    link(target) {
      return relative(file, fileFor(locale, target));
    },
    langHref(targetLocale) {
      return relative(file, fileFor(targetLocale, page));
    },
    t(key) {
      return t(locale, key);
    },
  };
}

function localizeProject(project, locale) {
  if (locale === "fr") return project;
  const pack = contentMessages(locale);
  const extra = (pack.projects && pack.projects[project.id]) || {};
  const category = (pack.categories && pack.categories[project.category]) || extra.category || project.category;
  return {
    ...project,
    title: extra.title || project.title,
    excerpt: extra.excerpt || project.excerpt,
    story: extra.story || project.story,
    category,
  };
}

function localizePost(post, locale) {
  if (locale === "fr") return post;
  const extra = (contentMessages(locale).posts && contentMessages(locale).posts[post.slug]) || null;
  if (!extra) return post;
  const blocks = (post.blocks || []).map((block, index) => {
    const translated = extra.blocks && extra.blocks[String(index)];
    if (translated == null) return block;
    if (typeof translated === "string") return { ...block, text: translated };
    if (Array.isArray(translated)) return { ...block, items: translated };
    return { ...block, ...translated, src: block.src, images: block.images };
  });
  return {
    ...post,
    title: extra.title || post.title,
    excerpt: extra.excerpt || post.excerpt,
    dateLabel: extra.dateLabel || post.dateLabel,
    blocks,
    cover: post.cover,
  };
}

function escapeText(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}

function applyCatalog(html, locale) {
  const dict = messages(locale);
  const valueOf = (key) => {
    const value = lookup(dict, key);
    return typeof value === "string" ? value : null;
  };

  html = html.replace(/<([a-zA-Z0-9]+)([^>]*?\sdata-i18n-html="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/g, (full, tag, attrs, key) => {
    const value = valueOf(key);
    if (value == null) return full;
    return `<${tag}${attrs}>${value}</${tag}>`;
  });

  html = html.replace(/<([a-zA-Z0-9]+)([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([^<]*)<\/\1>/g, (full, tag, attrs, key) => {
    const value = valueOf(key);
    if (value == null) return full;
    return `<${tag}${attrs}>${escapeText(value)}</${tag}>`;
  });

  html = html.replace(/<[^>]+>/g, (tag) => {
    if (!/data-i18n-(placeholder|alt|aria-label|content|title)=/.test(tag)) return tag;
    let next = tag;
    for (const match of tag.matchAll(/data-i18n-(placeholder|alt|aria-label|content|title)="([^"]+)"/g)) {
      const value = valueOf(match[2]);
      if (value == null) continue;
      const escaped = escapeAttr(value);
      const pattern = new RegExp(`\\s${match[1]}="[^"]*"`);
      if (pattern.test(next)) next = next.replace(pattern, ` ${match[1]}="${escaped}"`);
      else next = next.replace(/>$/, ` ${match[1]}="${escaped}">`);
    }
    return next;
  });

  return html;
}

function rewriteMarkedLinks(html, outputFile, attr) {
  const pattern = new RegExp(`<a\\b[^>]*\\s${attr}="(fr|en)"[^>]*>`, "g");
  return html.replace(pattern, (tag, locale) => {
    const page = outputFile.replace(/^en\//, "");
    const href = relative(outputFile, fileFor(locale, page));
    if (/href="/.test(tag)) return tag.replace(/href="[^"]*"/, `href="${href}"`);
    return tag.replace(/>$/, ` href="${href}">`);
  }).replace(new RegExp(`<link\\b[^>]*\\s${attr}="(fr|en)"[^>]*>`, "g"), (tag, locale) => {
    const page = outputFile.replace(/^en\//, "");
    const href = relative(outputFile, fileFor(locale, page));
    if (/href="/.test(tag)) return tag.replace(/href="[^"]*"/, `href="${href}"`);
    return tag.replace(/>$/, ` href="${href}">`);
  });
}

function rewriteAssets(html, outputFile) {
  const prefix = assetPrefix(outputFile);
  if (!prefix) return html;
  return html
    .replace(/(href|src)="(styles\.css|script\.js|client-gallery\.js)"/g, `$1="${prefix}$2"`)
    .replace(/(href|src)="images\//g, `$1="${prefix}images/`);
}

function buildStatic(siteRoot) {
  const pages = ["index.html", "services.html", "contact.html", "client-gallery.html"];
  const dir = path.join(siteRoot, "en");
  fs.mkdirSync(dir, { recursive: true });
  for (const page of pages) {
    let html = fs.readFileSync(path.join(siteRoot, page), "utf8");
    html = applyCatalog(html, "en");
    const output = `en/${page}`;
    html = rewriteMarkedLinks(html, output, "data-lang");
    html = rewriteMarkedLinks(html, output, "data-hreflang");
    html = rewriteAssets(html, output);
    html = html.replace(/<html lang="[^"]*">/, '<html lang="en">');
    html = html.replace(/hl=fr/g, "hl=en");
    fs.writeFileSync(path.join(siteRoot, output), html);
  }
}

module.exports = {
  t,
  createContext,
  localizeProject,
  localizePost,
  buildStatic,
  escapeText: escapeText,
};
