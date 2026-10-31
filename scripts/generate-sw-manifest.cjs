const fs = require("node:fs"),
  path = require("node:path");
const version = require("../package.json").version;
const dist = process.env.TRIPFLOW_UI_TEST ? ".next-ui" : ".next";
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
}
const assets = files(path.join(dist, "static"))
  .filter((f) => /\.(js|css|woff2?)$/.test(f))
  .map((f) => "/_next/" + path.relative(dist, f).split(path.sep).join("/"))
  .sort();
const source = fs
  .readFileSync("scripts/sw-template.js", "utf8")
  .replace("__VERSION__", JSON.stringify(version))
  .replace("__ASSETS__", JSON.stringify(assets));
fs.writeFileSync("public/sw.js", source);
console.log(
  `Offline shell V${version}: ${assets.length} assets (including lazy modules).`,
);
