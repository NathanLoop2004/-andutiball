// Servidor del panel: sirve la página y consulta el estado de las 3 salas.
//
// SALAS: lista "clave|nombre|url" separada por comas.
// Ej: SALAS="3v3|3v3|http://host-3v3:3000,4v4|4v4|http://host-4v4:3000"

const fs = require("fs");
const http = require("http");
const path = require("path");
const { leerRangos, guardarRangos, sinClave } = require("../lib/rangos");

const PUERTO = Number(process.env.PANEL_PORT || 8080);
const SALAS = (process.env.SALAS || "local|Sala local|http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => {
    const [clave, nombre, url] = s.split("|");
    return { clave, nombre: nombre || clave, url };
  });

const TIMEOUT_MS = 2500;

async function pedirEstado(sala) {
  const control = new AbortController();
  const corte = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${sala.url}/api/estado`, { signal: control.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const estado = await res.json();
    return { ...sala, ok: true, estado };
  } catch (error) {
    return { ...sala, ok: false, error: error.name === "AbortError" ? "sin respuesta" : error.message };
  } finally {
    clearTimeout(corte);
  }
}

const servidor = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/salas")) {
    const salas = await Promise.all(SALAS.map(pedirEstado));
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ salas }));
    return;
  }

  // Rangos: se leen y se guardan en roles.json, que las salas vigilan
  if (req.url.startsWith("/api/rangos")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (req.method === "GET") {
      res.end(JSON.stringify(sinClave(leerRangos())));
      return;
    }
    if (req.method === "POST") {
      let cuerpo = "";
      req.on("data", (c) => (cuerpo += c));
      req.on("end", () => {
        try {
          const enviado = JSON.parse(cuerpo);
          const actual = leerRangos();
          // Si no mandan clave nueva, se conserva la que ya estaba
          const guardado = guardarRangos({ ...enviado, clave: enviado.clave ? enviado.clave : actual.clave });
          res.end(JSON.stringify(sinClave(guardado)));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }
  }

  const archivo = path.join(__dirname, req.url.startsWith("/rangos") ? "rangos.html" : "index.html");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(fs.readFileSync(archivo));
});

servidor.listen(PUERTO, () => {
  console.log(`🖥️  Panel en http://localhost:${PUERTO}`);
  console.log(`   Salas: ${SALAS.map((s) => `${s.nombre} → ${s.url}`).join(" | ")}`);
});
