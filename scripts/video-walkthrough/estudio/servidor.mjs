#!/usr/bin/env node
import { execFile } from "node:child_process";
// El estudio del video walkthrough: una página local para grabar la voz de
// cada toma mirando el video (con la frase en pantalla en su segundo) y, si no
// hay ffmpeg, para armar el video final desde el navegador.
//
//   node scripts/video-walkthrough/estudio/servidor.mjs
//
// Sirve solo en 127.0.0.1 (el micrófono pide un origen seguro, y localhost lo
// es). Lee y escribe únicamente en la carpeta de grabaciones
// (~/Movies/propnexus-walkthrough, o $CARPETA). Ctrl-C lo apaga.
import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { leerTomas, srt } from "../lib/tomas.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CARPETA = process.env.CARPETA ?? join(homedir(), "Movies", "propnexus-walkthrough");
const PUERTO = Number(process.env.PUERTO ?? 8765);

const TIPOS = { mov: "video/quicktime", mp4: "video/mp4", webm: "video/webm", m4a: "audio/mp4" };
const ARCHIVO_VALIDO = /^(T\d\d\.(mov|webm|m4a)|walkthrough-final\.(mp4|webm|srt))$/;

function estado() {
  return leerTomas().map((t) => {
    const voz = ["webm", "m4a"]
      .map((ext) => `${t.toma}.${ext}`)
      .filter((f) => existsSync(join(CARPETA, f)))
      .sort((a, b) => statSync(join(CARPETA, b)).mtimeMs - statSync(join(CARPETA, a)).mtimeMs)[0];
    return { ...t, mov: existsSync(join(CARPETA, `${t.toma}.mov`)), voz: voz ?? null };
  });
}

function servirArchivo(req, res, nombre) {
  const ruta = join(CARPETA, nombre);
  if (!ARCHIVO_VALIDO.test(nombre) || !existsSync(ruta)) return fin(res, 404, "no existe");
  const tam = statSync(ruta).size;
  const tipo = TIPOS[nombre.split(".").pop()] ?? "application/octet-stream";
  const rango = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (rango) {
    const desde = rango[1] ? Number(rango[1]) : 0;
    const hasta = rango[2] ? Number(rango[2]) : tam - 1;
    res.writeHead(206, {
      "Content-Type": tipo,
      "Content-Length": hasta - desde + 1,
      "Content-Range": `bytes ${desde}-${hasta}/${tam}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store"
    });
    return createReadStream(ruta, { start: desde, end: hasta }).pipe(res);
  }
  res.writeHead(200, {
    "Content-Type": tipo,
    "Content-Length": tam,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store"
  });
  createReadStream(ruta).pipe(res);
}

async function guardar(req, res, nombre) {
  if (!ARCHIVO_VALIDO.test(nombre)) return fin(res, 400, "nombre inválido");
  await pipeline(req, createWriteStream(join(CARPETA, nombre)));
  console.log(`  guardado ${nombre}`);
  fin(res, 200, "ok");
}

function fin(res, codigo, cuerpo, tipo = "text/plain; charset=utf-8") {
  res.writeHead(codigo, { "Content-Type": tipo, "Cache-Control": "no-store" });
  res.end(cuerpo);
}

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "GET" && url.pathname === "/")
      return fin(res, 200, readFileSync(join(AQUI, "index.html")), "text/html; charset=utf-8");
    if (req.method === "GET" && url.pathname === "/tomas.json")
      return fin(
        res,
        200,
        JSON.stringify({ carpeta: CARPETA, tomas: estado() }),
        "application/json"
      );
    if (req.method === "GET" && url.pathname.startsWith("/media/"))
      return servirArchivo(req, res, decodeURIComponent(url.pathname.slice(7)));
    if (req.method === "POST" && url.pathname.startsWith("/voz/"))
      return guardar(req, res, `${url.pathname.slice(5)}.webm`);
    if (req.method === "POST" && url.pathname === "/final")
      return guardar(
        req,
        res,
        `walkthrough-final.${url.searchParams.get("ext") === "mp4" ? "mp4" : "webm"}`
      );
    if (req.method === "POST" && url.pathname === "/final-srt") {
      let cuerpo = "";
      for await (const pedazo of req) cuerpo += pedazo;
      const inicios = JSON.parse(cuerpo);
      writeFileSync(
        join(CARPETA, "walkthrough-final.srt"),
        srt(leerTomas(), (t) => inicios[t])
      );
      console.log("  guardado walkthrough-final.srt");
      return fin(res, 200, "ok");
    }
    fin(res, 404, "no existe");
  } catch (e) {
    console.error(e);
    fin(res, 500, String(e.message ?? e));
  }
});

if (!existsSync(CARPETA)) {
  console.error(`No existe ${CARPETA}. Corré antes: bash scripts/video-walkthrough/preparar.sh`);
  process.exit(1);
}
servidor.listen(PUERTO, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${PUERTO}/`;
  console.log(`Estudio en ${url} — carpeta ${CARPETA}`);
  console.log("Dejá esta Terminal abierta; Ctrl-C lo apaga.");
  if (!process.env.SIN_ABRIR)
    execFile("open", ["-a", "Google Chrome", url], (e) => e && execFile("open", [url]));
});
