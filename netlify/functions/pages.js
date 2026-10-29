const fs = require("fs");
const path = require("path");
const { createContext } = require("../../lib/i18n");
const { portfolioPage, projectPage, blogIndex, articlePage } = require("../../lib/render");
const { cloudConfig } = require("../../lib/gallery-cloud");
const { getJson } = require("../../lib/site-store");

function readFallback(name) {
  const candidates = [
    path.join(process.cwd(), "data", name),
    path.join(__dirname, "data", name),
    path.join(__dirname, "..", "..", "data", name),
  ];
  const file = candidates.find((item) => fs.existsSync(item));
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requestPath(event) {
  const raw = new URL(event.rawUrl || "https://boisseriejimmy.com/").pathname;
  return decodeURIComponent(raw.replace(/^\/\.netlify\/functions\/pages/, "") || "/");
}

function html(status, body) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body,
  };
}

exports.handler = async (event) => {
  try {
    const { key, secret } = cloudConfig();
    let portfolio = null;
    let postsFile = null;
    if (key && secret) {
      portfolio = await getJson("portfolio.json");
      postsFile = await getJson("posts.json");
    }
    portfolio = portfolio || readFallback("portfolio.json") || { projects: [] };
    postsFile = postsFile || readFallback("posts.json") || { posts: [] };
    const projects = portfolio.projects || [];
    const posts = postsFile.posts || [];
    const pathname = requestPath(event).replace(/\/$/, "") || "/";
    const locale = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "fr";
    const page = pathname.replace(/^\/en\/?/, "").replace(/^\//, "") || "index.html";

    if (page === "portfolio" || page === "portfolio.html") {
      return html(200, portfolioPage(projects, createContext(locale, "portfolio.html")));
    }
    const projectMatch = page.match(/^portfolio\/([^/]+?)(?:\.html)?$/);
    if (projectMatch) {
      const slug = projectMatch[1];
      const project = projects.find((item) => item.slug === slug);
      if (!project) return html(404, "<!DOCTYPE html><title>Introuvable</title><p>Ce projet n'existe pas.</p>");
      return html(200, projectPage(project, projects, createContext(locale, `portfolio/${slug}.html`)));
    }
    if (page === "blog" || page === "blog.html") {
      return html(200, blogIndex(posts, createContext(locale, "blog.html")));
    }
    const postMatch = page.match(/^blog\/([^/]+?)(?:\.html)?$/);
    if (postMatch) {
      const slug = postMatch[1];
      const post = posts.find((item) => item.slug === slug);
      if (!post) return html(404, "<!DOCTYPE html><title>Introuvable</title><p>Cet article n'existe pas.</p>");
      return html(200, articlePage(post, createContext(locale, `blog/${slug}.html`)));
    }
    return html(404, "<!DOCTYPE html><title>Introuvable</title><p>Page introuvable.</p>");
  } catch (error) {
    return html(500, `<!DOCTYPE html><title>Erreur</title><p>${String(error.message || "Erreur").replace(/[<>]/g, "")}</p>`);
  }
};
