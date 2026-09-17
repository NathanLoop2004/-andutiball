// =============================================================================
// Discord — vincular la cuenta de Discord de un usuario y meterlo al servidor (OAuth2).
//
// No es para iniciar sesión: el usuario ya entró a la web con su cuenta, y esto solo le asocia
// su Discord. Se piden dos permisos ("scopes"):
//   identify     → saber quién es (id, usuario, avatar)
//   guilds.join  → poder agregarlo al servidor de ÑandutíBall
//
// Se configura en .env (ver .env.example):
//   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET   la aplicación del portal de Discord
//   DISCORD_BOT_TOKEN                          el bot de esa aplicación, que tiene que estar en el servidor
//   DISCORD_GUILD_ID                           el id del servidor
//   DISCORD_REDIRECT_URI (opcional)            la dirección de vuelta; si no está, se arma con la web
//
// El access_token de Discord se usa una sola vez (para saber quién es y meterlo al servidor) y
// se descarta: no se guarda en ningún lado.
//
// Las pruebas cambian el fetch con Discord.usarFetch(fn): no se habla con Discord de verdad.
// =============================================================================

const API = "https://discord.com/api/v10";
const AUTORIZAR = "https://discord.com/oauth2/authorize";
const SCOPES = ["identify", "guilds.join"];

let fetchDePrueba = null;
const pedir = (...args) => (fetchDePrueba || fetch)(...args);

const cfg = () => ({
  clientId: (process.env.DISCORD_CLIENT_ID || "").trim(),
  clientSecret: (process.env.DISCORD_CLIENT_SECRET || "").trim(),
  botToken: (process.env.DISCORD_BOT_TOKEN || "").trim(),
  guildId: (process.env.DISCORD_GUILD_ID || "").trim(),
  redirect: (process.env.DISCORD_REDIRECT_URI || "").trim(),
});

// Lo que falta configurar (vacío = listo)
function faltaConfigurar() {
  const c = cfg();
  const faltan = [];
  if (!c.clientId) faltan.push("DISCORD_CLIENT_ID");
  if (!c.clientSecret) faltan.push("DISCORD_CLIENT_SECRET");
  if (!c.botToken) faltan.push("DISCORD_BOT_TOKEN");
  if (!c.guildId) faltan.push("DISCORD_GUILD_ID");
  return faltan;
}

function urlParaAutorizar({ state, redirectUri }) {
  const q = new URLSearchParams({
    client_id: cfg().clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    prompt: "consent",
  });
  return `${AUTORIZAR}?${q}`;
}

async function leerRespuesta(res, que) {
  const texto = await res.text().catch(() => "");
  let datos = null;
  try { datos = JSON.parse(texto); } catch (e) { /* no era JSON */ }
  if (!res.ok) {
    const detalle = datos && (datos.error_description || datos.message || datos.error);
    const error = new Error(`Discord respondió ${res.status} al ${que}${detalle ? ": " + detalle : ""}`);
    error.status = res.status;
    throw error;
  }
  return datos;
}

// code → access_token (se usa y se descarta)
async function canjearCodigo({ code, redirectUri }) {
  const c = cfg();
  const res = await pedir(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  const datos = await leerRespuesta(res, "canjear el código");
  if (!datos || !datos.access_token) throw new Error("Discord no devolvió el permiso");
  const scopes = String(datos.scope || "").split(" ");
  if (!scopes.includes("identify")) throw new Error("No se dio permiso para ver tu usuario de Discord");
  return { accessToken: datos.access_token, puedeUnirse: scopes.includes("guilds.join") };
}

async function quienSoy(accessToken) {
  const res = await pedir(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const u = await leerRespuesta(res, "pedir tu usuario");
  return {
    id: String(u.id),
    usuario: u.global_name ? `${u.global_name} (@${u.username})` : `@${u.username}`,
    avatar: u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=96` : null,
  };
}

// Lo mete al servidor con el bot. 201 = lo agregó · 204 = ya estaba
async function meterAlServidor({ discordId, accessToken }) {
  const c = cfg();
  const res = await pedir(`${API}/guilds/${c.guildId}/members/${discordId}`, {
    method: "PUT",
    headers: { Authorization: `Bot ${c.botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (res.status === 204) return "ya-estaba";
  await leerRespuesta(res, "agregarte al servidor");
  return "agregado";
}

module.exports = {
  SCOPES,
  faltaConfigurar,
  urlParaAutorizar,
  canjearCodigo,
  quienSoy,
  meterAlServidor,
  usarFetch: (fn) => { fetchDePrueba = fn || null; },
};
