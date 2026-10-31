const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib");
const root =
  process.argv[2] || (process.env.TRIPFLOW_UI_TEST ? ".next-ui" : ".next");
const html = fs.readFileSync(path.join(root, "server/app/index.html"), "utf8");
const files = [
  ...new Set(
    [...html.matchAll(/<script[^>]*src="(\/_next\/[^\"]+\.js)"/g)].map(
      (m) => m[1],
    ),
  ),
];
const data = files.map((url) =>
  fs.readFileSync(path.join(root, url.replace("/_next/", ""))),
);
console.log(
  JSON.stringify(
    {
      initialJsFiles: files.length,
      initialRawBytes: data.reduce((n, b) => n + b.length, 0),
      initialGzipBytes: data.reduce((n, b) => n + zlib.gzipSync(b).length, 0),
    },
    null,
    2,
  ),
);
