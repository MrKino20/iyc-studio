const fs = require("fs");
const path = require("path");
const { createContext, localizeProject, localizePost, buildStatic } = require("./i18n");

const FONTS = "https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&family=Lato:wght@300;400;700&display=swap";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(ctx, { title, description, body, active }) {
  const { asset } = ctx;
  const item = (href, label, key) =>
    `<li><a href="${ctx.link(href)}"${active === key ? ' class="active"' : ""}>${esc(label)}</a></li>`;
  const flag = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@7.3.2/flags/4x3";
  return `<!DOCTYPE html>
<html lang="${ctx.locale}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <link rel="alternate" hreflang="fr" href="${ctx.langHref("fr")}">
    <link rel="alternate" hreflang="en" href="${ctx.langHref("en")}">
    <link rel="stylesheet" href="${asset}styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${FONTS}" rel="stylesheet">
</head>
<body>
    <header class="header">
        <div class="promo-banner">
            <div class="promo-track">
                <p><strong>${esc(ctx.t("promo.title"))}</strong> <span>${esc(ctx.t("promo.text"))}</span></p>
                <p aria-hidden="true"><strong>${esc(ctx.t("promo.title"))}</strong> <span>${esc(ctx.t("promo.text"))}</span></p>
            </div>
        </div>
        <nav class="navbar">
            <div class="nav-container">
                <a href="${ctx.link("index.html")}" class="logo">
                    <img src="${asset}images/fichier-1-300x-AoPvowXDj1U242O6.png" alt="IYC Studio logo">
                </a>
                <button class="mobile-menu-toggle" aria-label="${esc(ctx.t("nav.menu"))}">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
                <ul class="nav-menu">
                    ${item("index.html", ctx.t("nav.home"), "home")}
                    ${item("services.html", ctx.t("nav.services"), "services")}
                    ${item("portfolio.html", ctx.t("nav.portfolio"), "portfolio")}
                    ${item("contact.html", ctx.t("nav.contact"), "contact")}
                    ${item("blog.html", ctx.t("nav.blog"), "blog")}
                    ${item("client-gallery.html", ctx.t("nav.gallery"), "gallery")}
                    <li><a href="https://cal.com/jimmy-boisserie-ylxxoq/echange-pour-un-devis" class="cta-button-nav" target="_blank" rel="noopener noreferrer">${esc(ctx.t("nav.book"))}</a></li>
                    <li class="language-selector">
                        <button class="lang-toggle" type="button">
                            <img src="${flag}/${ctx.locale === "en" ? "us" : "fr"}.svg" alt="${ctx.locale === "en" ? "EN" : "FR"}" class="flag-icon">
                        </button>
                        <ul class="lang-dropdown">
                            <li><a href="${ctx.langHref("fr")}"><img src="${flag}/fr.svg" alt="FR"> Français (FR)</a></li>
                            <li><a href="${ctx.langHref("en")}"><img src="${flag}/us.svg" alt="EN"> English (US)</a></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </nav>
    </header>
    ${body}
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-col">
                    <h4>${esc(ctx.t("footer.authenticity"))}</h4>
                    <p>${esc(ctx.t("footer.tagline"))}</p>
                </div>
                <div class="footer-col">
                    <h4>${esc(ctx.t("footer.contact"))}</h4>
                    <p>${esc(ctx.t("footer.emailLabel"))} : <a href="mailto:jimmy.boisserie@gmail.com">jimmy.boisserie@gmail.com</a></p>
                    <p>${esc(ctx.t("footer.phoneLabel"))} : <a href="tel:+33777818930">+33 7 77 81 89 30</a></p>
                </div>
                <div class="footer-col">
                    <h4>${esc(ctx.t("footer.social"))}</h4>
                    <div class="footer-social-row">
                    <div class="footer-social">
                        <a href="https://www.instagram.com/iyc_studio/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg></a>
                        <a href="https://www.facebook.com/profile.php?id=61576980584744" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg></a>
                        <a href="https://www.linkedin.com/in/jimmy-boisserie/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg></a>
                        <a href="https://www.behance.net/BoisserieJimmy" target="_blank" rel="noopener noreferrer" aria-label="Behance"><span class="behance-mark">Be</span></a>
                    </div>
                    <p class="footer-rights">${ctx.t("footer.rights")}</p>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    <script src="${asset}script.js"></script>
</body>
</html>
`;
}

function imgPath(src, asset) {
  const clean = String(src || "").replace(/^\.\.\//, "");
  if (/^https?:\/\//.test(clean)) return clean;
  return asset + clean.replace(/^\//, "");
}

function renderBlocks(blocks, asset) {
  return (blocks || [])
    .map((block) => {
      if (block.type === "heading") {
        const tag = block.level === 3 ? "h3" : "h2";
        return `<${tag}>${esc(block.text)}</${tag}>`;
      }
      if (block.type === "paragraph") {
        return `<p>${esc(block.text).replace(/\n/g, "<br>")}</p>`;
      }
      if (block.type === "html") {
        return `<p>${block.html}</p>`;
      }
      if (block.type === "button") {
        return `<p><a class="cta-button" href="${esc(block.href)}">${esc(block.label)}</a></p>`;
      }
      if (block.type === "list") {
        const items = (block.items || []).map((item) => `<li>${esc(item)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (block.type === "image") {
        const caption = block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : "";
        return `<figure class="article-figure"><img src="${imgPath(block.src, asset)}" alt="${esc(block.alt || block.caption || "")}" loading="lazy">${caption}</figure>`;
      }
      if (block.type === "gallery") {
        const figures = (block.images || [])
          .map((image) => {
            const src = typeof image === "string" ? image : image.src;
            const alt = typeof image === "string" ? "" : image.alt || "";
            return `<figure><img src="${imgPath(src, asset)}" alt="${esc(alt)}" loading="lazy"></figure>`;
          })
          .join("");
        return `<div class="article-gallery">${figures}</div>`;
      }
      return "";
    })
    .join("\n");
}

function portfolioPage(projects, ctx) {
  const localized = projects.map((project) => localizeProject(project, ctx.locale));
  const cards = localized
    .map((project) => {
      const place = [project.location, project.year].filter(Boolean).join(" · ");
      return `<a class="work-card" href="${ctx.link(`portfolio/${project.slug}.html`)}" data-category="${esc(project.category)}">
        <img src="${imgPath(project.cover, ctx.asset)}" alt="${esc(project.title)}" style="object-position:${esc(project.coverPosition || "50% 50%")}">
        <span class="work-card-cta">${esc(ctx.t("portfolio.viewSeries"))}</span>
        <div class="work-card-meta">
            <span>${esc(project.category)}</span>
            <h2>${esc(project.title)}</h2>
            <p>${esc(place || project.excerpt)}</p>
        </div>
    </a>`;
    })
    .join("\n");
  const categories = [ctx.t("portfolio.all"), ...new Set(localized.map((project) => project.category))];
  const filters = categories
    .map((category, index) => `<button type="button" data-filter="${esc(category)}"${index === 0 ? ' class="active"' : ""}>${esc(category)}</button>`)
    .join("");
  return shell(ctx, {
    title: ctx.t("portfolio.metaTitle"),
    description: ctx.t("portfolio.metaDescription"),
    active: "portfolio",
    body: `<section class="page-header">
        <div class="container">
            <h1>${esc(ctx.t("portfolio.heading"))}</h1>
            <p>${esc(ctx.t("portfolio.intro"))}</p>
        </div>
    </section>
    <section class="works">
        <div class="container">
            <div class="work-filters">${filters}</div>
            <div class="work-grid">${cards}</div>
        </div>
    </section>
    <script>
    document.querySelectorAll(".work-filters button").forEach((button) => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".work-filters button").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            const filter = button.dataset.filter;
            document.querySelectorAll(".work-card").forEach((card) => {
                card.style.display = filter === ${JSON.stringify(ctx.t("portfolio.all"))} || card.dataset.category === filter ? "" : "none";
            });
        });
    });
    </script>`,
  });
}

function projectPage(project, projects, ctx) {
  const localized = projects.map((item) => localizeProject(item, ctx.locale));
  const current = localized.find((item) => item.slug === project.slug) || localizeProject(project, ctx.locale);
  const index = localized.findIndex((item) => item.slug === project.slug);
  const next = localized[(index + 1) % localized.length];
  const facts = [
    [ctx.t("portfolio.facts.universe"), current.category],
    [ctx.t("portfolio.facts.place"), current.location],
    [ctx.t("portfolio.facts.year"), current.year],
    [ctx.t("portfolio.facts.photos"), String((current.photos || []).length)],
  ].filter(([, value]) => value);
  const gallery = (current.photos || [])
    .map(
      (src) => `<figure><img src="${imgPath(src, ctx.asset)}" alt="${esc(current.title)}" loading="lazy"></figure>`
    )
    .join("");
  const story = (current.story || []).map((paragraph) => `<p>${esc(paragraph)}</p>`).join("");
  return shell(ctx, {
    title: `${current.title} | IYC Studio`,
    description: current.excerpt || current.title,
    active: "portfolio",
    body: `<section class="project-hero${current.textColor === "black" ? " hero-text-dark" : ""}">
        <a class="project-back" href="${ctx.link("portfolio.html")}" aria-label="${esc(ctx.t("portfolio.back"))}">&#8592;</a>
        <img src="${imgPath(current.cover, ctx.asset)}" alt="${esc(current.title)}" style="object-position:${esc(current.coverPosition || "50% 50%")}">
        <div class="project-hero-content">
            <p class="eyebrow">${esc(current.category)}</p>
            <h1>${esc(current.title)}</h1>
            <p>${esc(current.excerpt || "")}</p>
        </div>
    </section>
    <section class="container project-story">
        <aside class="project-facts">
            ${facts.map(([label, value]) => `<p><strong>${esc(label)}</strong>${esc(value)}</p>`).join("")}
        </aside>
        <div class="project-story-text">${story}</div>
    </section>
    <section class="container project-gallery">${gallery}</section>
    <div class="container project-next">
        <a href="${ctx.link("portfolio.html")}">${esc(ctx.t("portfolio.allProjects"))}</a>
        <a href="${esc(next.slug)}.html">${esc(ctx.t("portfolio.next"))} · ${esc(next.title)}</a>
    </div>
    <section class="cta-section">
        <div class="container">
            <h2 class="project-cta-title">${esc(ctx.t("portfolio.ctaTitle"))}</h2>
            <a class="cta-button" href="https://cal.com/jimmy-boisserie-ylxxoq/echange-pour-un-devis" target="_blank" rel="noopener noreferrer">${esc(ctx.t("portfolio.ctaButton"))}</a>
        </div>
    </section>
    <div id="lightbox" class="lightbox">
        <button class="lightbox-close" aria-label="${esc(ctx.t("portfolio.close"))}">&times;</button>
        <button class="lightbox-prev" type="button" aria-label="${esc(ctx.t("portfolio.prev"))}">&#10094;</button>
        <button class="lightbox-next" type="button" aria-label="${esc(ctx.t("portfolio.nextPhoto"))}">&#10095;</button>
        <img id="lightboxImage" alt="">
    </div>
    <script>
    (function () {
        const box = document.getElementById("lightbox");
        const image = document.getElementById("lightboxImage");
        const photos = [...document.querySelectorAll(".project-gallery img")];
        let current = 0;
        function show(index) {
            if (!photos.length) return;
            current = (index + photos.length) % photos.length;
            image.src = photos[current].src;
            image.alt = photos[current].alt;
            box.classList.add("active");
        }
        photos.forEach((item, index) => item.addEventListener("click", () => show(index)));
        box.querySelector(".lightbox-prev").addEventListener("click", (event) => {
            event.stopPropagation();
            show(current - 1);
        });
        box.querySelector(".lightbox-next").addEventListener("click", (event) => {
            event.stopPropagation();
            show(current + 1);
        });
        box.addEventListener("click", (event) => {
            if (event.target === box || event.target.classList.contains("lightbox-close")) {
                box.classList.remove("active");
            }
        });
        document.addEventListener("keydown", (event) => {
            if (!box.classList.contains("active")) return;
            if (event.key === "Escape") box.classList.remove("active");
            if (event.key === "ArrowLeft") show(current - 1);
            if (event.key === "ArrowRight") show(current + 1);
        });
    })();
    </script>`,
  });
}

function blogIndex(posts, ctx) {
  const localized = posts.map((post) => localizePost(post, ctx.locale));
  const cards = [...localized]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(
      (post) => `<article class="blog-card">
        <a href="${ctx.link(`blog/${post.slug}.html`)}"><img src="${imgPath(post.cover, ctx.asset)}" alt=""></a>
        <div class="blog-card-body">
            <p class="blog-meta">${esc(post.dateLabel || post.date)} · ${esc(post.minutes || "")} ${esc(ctx.t("blog.minutes"))}</p>
            <h2><a href="${ctx.link(`blog/${post.slug}.html`)}">${esc(post.title)}</a></h2>
            <p>${esc(post.excerpt || "")}</p>
            <a class="cta-button" href="${ctx.link(`blog/${post.slug}.html`)}">${esc(ctx.t("blog.read"))}</a>
        </div>
    </article>`
    )
    .join("");
  return shell(ctx, {
    title: ctx.t("blog.metaTitle"),
    description: ctx.t("blog.metaDescription"),
    active: "blog",
    body: `<section class="page-header"><div class="container"><h1>${esc(ctx.t("blog.heading"))}</h1><p>${esc(ctx.t("blog.intro"))}</p></div></section>
    <section class="blog-section"><div class="container"><div class="blog-list">${cards}</div></div></section>`,
  });
}

function articlePage(post, ctx) {
  const localized = localizePost(post, ctx.locale);
  return shell(ctx, {
    title: `${localized.title} | IYC Studio`,
    description: localized.excerpt || localized.title,
    active: "blog",
    body: `<section class="page-header">
        <div class="container">
            <p class="blog-meta"><a href="${ctx.link("blog.html")}">${esc(ctx.t("blog.heading"))}</a> · ${esc(localized.dateLabel || localized.date)} · ${esc(localized.minutes || "")} ${esc(ctx.t("blog.reading"))}</p>
            <h1>${esc(localized.title)}</h1>
        </div>
    </section>
    <section class="blog-section">
        <a class="gallery-back" href="${ctx.link("blog.html")}" aria-label="${esc(ctx.t("blog.back"))}">&#8592;</a>
        <div class="container">
            <article class="article">
                ${localized.cover ? `<img class="article-cover" src="${imgPath(localized.cover, ctx.asset)}" alt="">` : ""}
                <div class="article-body">
                    ${renderBlocks(localized.blocks, ctx.asset)}
                </div>
                <div class="project-next">
                    <a href="${ctx.link("blog.html")}">${esc(ctx.t("blog.back"))}</a>
                </div>
            </article>
        </div>
    </section>`,
  });
}

function writeLocale(root, locale, projects, posts) {
  const portfolioCtx = createContext(locale, "portfolio.html");
  const blogCtx = createContext(locale, "blog.html");
  const base = locale === "en" ? path.join(root, "en") : root;
  fs.mkdirSync(base, { recursive: true });
  fs.writeFileSync(path.join(base, "portfolio.html"), portfolioPage(projects, portfolioCtx));
  const portfolioDir = path.join(base, "portfolio");
  fs.mkdirSync(portfolioDir, { recursive: true });
  const slugs = new Set(projects.map((project) => project.slug));
  for (const file of fs.readdirSync(portfolioDir)) {
    if (file.endsWith(".html") && !slugs.has(file.replace(/\.html$/, ""))) {
      fs.unlinkSync(path.join(portfolioDir, file));
    }
  }
  for (const project of projects) {
    const ctx = createContext(locale, `portfolio/${project.slug}.html`);
    fs.writeFileSync(path.join(portfolioDir, `${project.slug}.html`), projectPage(project, projects, ctx));
  }
  fs.writeFileSync(path.join(base, "blog.html"), blogIndex(posts, blogCtx));
  const blogDir = path.join(base, "blog");
  fs.mkdirSync(blogDir, { recursive: true });
  for (const post of posts) {
    const ctx = createContext(locale, `blog/${post.slug}.html`);
    fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), articlePage(post, ctx));
  }
}

function renderAll(root) {
  const portfolio = JSON.parse(fs.readFileSync(path.join(root, "data", "portfolio.json"), "utf8"));
  const postsFile = JSON.parse(fs.readFileSync(path.join(root, "data", "posts.json"), "utf8"));
  const projects = portfolio.projects || [];
  const posts = postsFile.posts || [];
  writeLocale(root, "fr", projects, posts);
  writeLocale(root, "en", projects, posts);
  buildStatic(root);
}

function blogImages(posts) {
  const files = new Set();
  for (const post of posts || []) {
    if (post.cover) files.add(path.basename(post.cover));
    for (const block of post.blocks || []) {
      if (block.type === "image" && block.src) files.add(path.basename(block.src));
      if (block.type === "gallery") {
        for (const image of block.images || []) {
          files.add(path.basename(typeof image === "string" ? image : image.src));
        }
      }
    }
  }
  files.delete("fichier-1-300x-AoPvowXDj1U242O6.png");
  return files;
}

module.exports = { renderAll, blogImages, esc, portfolioPage, projectPage, blogIndex, articlePage, createContext };
