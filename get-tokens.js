// Obtiene los tokens del host headless y los guarda en .env (Windows).
// Abre la página de tokens en tu navegador normal (el captcha de Cloudflare rechaza navegadores
// automatizados). Resuelves el captcha, copias el token (Ctrl+C) y el script lo detecta en el
// portapapeles, lo guarda y abre la página otra vez para la siguiente sala.
//
// Uso:  npm run tokens            → pide TOKEN_3V3, TOKEN_4V4 y TOKEN_TODOS
//       npm run tokens -- --up    → además corre "docker compose up -d --build" al terminar

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOKEN_URL = "https://www.haxball.com/headlesstoken";

// Por defecto pide los 3 tokens; con "--una" solo el de la sala de HOST_CONFIG (para npm start)
const salaElegida = (process.env.HOST_CONFIG || "hosts/todos.json").replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
const claveDeLaSala = `TOKEN_${salaElegida.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
const TOKEN_KEYS = process.argv.includes("--una") ? [claveDeLaSala] : ["TOKEN_3V3", "TOKEN_4V4", "TOKEN_TODOS"];
const TOKEN_PATTERN = /thr1\.[A-Za-z0-9_\-.]+/;
const ENV_PATH = path.join(__dirname, ".env");
const WAIT_TIMEOUT_MS = 5 * 60 * 1000;

function readClipboard() {
  try {
    return execSync("powershell -NoProfile -Command Get-Clipboard", { encoding: "utf8" });
  } catch {
    return "";
  }
}

function clearClipboard() {
  try {
    execSync("powershell -NoProfile -Command Set-Clipboard -Value ' '");
  } catch {
    // Si no se puede limpiar, igual se ignoran tokens ya usados
  }
}

function openBrowser(url) {
  execSync(`start "" "${url}"`, { shell: "cmd.exe" });
}

async function waitForCopiedToken(usedTokens) {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const match = readClipboard().match(TOKEN_PATTERN);
    if (match && !usedTokens.has(match[0])) return match[0];
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Se agotó el tiempo esperando el token (5 minutos)");
}

function saveToEnv(values) {
  let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  for (const [key, value] of Object.entries(values)) {
    const line = new RegExp(`^${key}=.*$`, "m");
    env = line.test(env) ? env.replace(line, `${key}=${value}`) : `${env.trimEnd()}\n${key}=${value}\n`;
  }
  fs.writeFileSync(ENV_PATH, env);
}

(async () => {
  const tokens = {};
  const usedTokens = new Set();
  clearClipboard();

  for (const key of TOKEN_KEYS) {
    console.log(`\n🔑 ${key}: resuelve el captcha en el navegador y copia el token (Ctrl+C)...`);
    openBrowser(TOKEN_URL);
    tokens[key] = await waitForCopiedToken(usedTokens);
    usedTokens.add(tokens[key]);
    console.log(`✅ ${key} obtenido`);
  }

  saveToEnv(tokens);
  clearClipboard();
  console.log(`\n💾 Tokens guardados en .env. Vencen en pocos minutos: arranca las salas ya.`);

  if (process.argv.includes("--up")) {
    console.log("🐳 docker compose up -d --build");
    execSync("docker compose up -d --build", { cwd: __dirname, stdio: "inherit" });
  }
})().catch((error) => {
  console.error("❌", error.message);
  process.exit(1);
});
