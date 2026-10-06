/*
 * Test page for the Modern Manufacturing layout tests.
 *
 *   GET /__test__/invoice?case=<ID>&width=<px>
 *     → the real renderer (dist/index.html) with this template and the case's fixture as its
 *       apiUrl. The container width is the viewport width, exactly as in Lydia, where the
 *       template renders inside an iframe the width of the preview.
 *   GET /__fixtures__/<ID>.json      → the case payload (cases.mjs)
 *   GET /__fixtures__/img/<name>.png → generated test images
 *   anything else                    → dist/, uncached
 *
 * Usage: node e2e/invoice-layout/server.mjs [port]   (after `npm run build`)
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildCase } from "./cases.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../../dist");
const port = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

/* A small striped PNG, so image placement is visible in screenshots. */
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};
const png = (size, [r1, g1, b1], [r2, g2, b2]) => {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = [0];
    for (let x = 0; x < size; x += 1) {
      const stripe = Math.floor((x + y) / Math.max(4, size / 8)) % 2 === 0;
      row.push(...(stripe ? [r1, g1, b1] : [r2, g2, b2]));
    }
    rows.push(Buffer.from(row));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
const IMAGES = {
  thumb: png(128, [38, 70, 120], [240, 150, 60]),
  large: png(560, [38, 70, 120], [235, 120, 110]),
};

const send = (res, status, type, body) => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const origin = `http://${req.headers.host}`;

    if (url.pathname === "/__test__/invoice") {
      const id = url.searchParams.get("case") || "A2";
      const apiUrl = Buffer.from(`${origin}/__fixtures__/${id}.json`).toString(
        "base64"
      );
      res.writeHead(302, {
        Location: `/index.html?template=modern-manufacturing-template&apiUrl=${encodeURIComponent(
          apiUrl
        )}`,
        "Cache-Control": "no-store",
      });
      res.end();
      return;
    }

    const fixture = url.pathname.match(/^\/__fixtures__\/([A-Z]\d+)\.json$/);
    if (fixture) {
      const payload = buildCase(fixture[1], origin);
      if (!payload) return send(res, 404, "text/plain", "unknown case");
      return send(res, 200, TYPES[".json"], JSON.stringify(payload));
    }

    const img = url.pathname.match(/^\/__fixtures__\/img\/(\w+)\.png$/);
    if (img && IMAGES[img[1]])
      return send(res, 200, TYPES[".png"], IMAGES[img[1]]);

    const file = path.join(dist, decodeURIComponent(url.pathname));
    if (!file.startsWith(dist))
      return send(res, 403, "text/plain", "forbidden");
    fs.readFile(file, (error, body) => {
      if (error) return send(res, 404, "text/plain", "not found");
      send(
        res,
        200,
        TYPES[path.extname(file)] || "application/octet-stream",
        body
      );
    });
  })
  .listen(port, () => {
    console.log(`invoice layout test server on http://localhost:${port}`);
  });
