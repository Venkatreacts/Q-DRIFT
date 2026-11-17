// Embeds compressed photos into the page template as data URIs (website version).
const fs = require("fs");
const sharp = require("sharp");
const [tpl, out] = process.argv.slice(2);
const D = "C:/Users/Public/qdrift/img/";

(async () => {
  const jpg = async (f, w, q = 78) => "data:image/jpeg;base64," + (await sharp(D + f).resize({ width: w, withoutEnlargement: true }).jpeg({ quality: q, mozjpeg: true }).toBuffer()).toString("base64");
  const png = async (f, w) => "data:image/png;base64," + (await sharp(D + f).resize({ width: w }).png({ palette: true, quality: 85, compressionLevel: 9 }).toBuffer()).toString("base64");
  const map = {
    ISSEARTH: await jpg("isseearth.jpg", 900),
    LAUNCH: await jpg("launch.jpg", 760),
    DSN: await jpg("dsn.jpg", 900),
    SELFIE: await jpg("selfie2019.jpg", 760),
    FRIDGE: await png("fridge.png", 640),
    AURORA: await jpg("aurora.jpg", 1000),
  };
  let html = fs.readFileSync(tpl, "utf8");
  for (const [k, v] of Object.entries(map)) html = html.split("%%" + k + "%%").join(v);
  if (/%%[A-Z]+%%/.test(html)) throw new Error("unfilled placeholder");
  fs.writeFileSync(out, html);
  console.log("wrote", out, Math.round(html.length / 1024) + " KB");
})().catch((e) => { console.error(e); process.exit(1); });
