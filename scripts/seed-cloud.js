const fs = require("fs");
const path = require("path");
const { ensureBuckets, getJson, putJson } = require("../lib/site-store");

const root = path.join(__dirname, "..");

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", name), "utf8"));
}

async function main() {
  await ensureBuckets();
  if (!(await getJson("portfolio.json"))) await putJson("portfolio.json", read("portfolio.json"));
  if (!(await getJson("posts.json"))) await putJson("posts.json", read("posts.json"));
  const authFile = path.join(root, "data", "auth.json");
  if (fs.existsSync(authFile) && !(await getJson("auth.json"))) {
    await putJson("auth.json", JSON.parse(fs.readFileSync(authFile, "utf8")));
  }
  const images = path.join(root, "images");
  const names = fs.existsSync(images)
    ? fs.readdirSync(images).filter((file) => /\.(jpe?g|png|webp|gif)$/i.test(file) && !file.startsWith("tableau-comparatif") && file !== "fichier-1-300x-AoPvowXDj1U242O6.png").sort()
    : [];
  fs.writeFileSync(path.join(root, "data", "library.json"), JSON.stringify(names, null, 2));
  console.log("cloud-ready", names.length);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
