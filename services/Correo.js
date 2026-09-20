// =============================================================================
// Correo — manda los mails de Ñandutí Web (por ahora: recuperar la cuenta).
//
// Va por Resend o SMTP. Se configura en .env:
//
//   RESEND_API_KEY=re_...
//   CORREO_REMITENTE="ÑandutíHax <soporte@nandutihax.com>"
//
// Alternativa SMTP:
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465                 465 = SSL · 587 = STARTTLS
//   SMTP_USUARIO=tu-cuenta@gmail.com
//   SMTP_CLAVE=xxxx xxxx xxxx xxxx  con Gmail: una "contraseña de aplicación", no tu clave normal
//   CORREO_REMITENTE="ÑandutíHax <tu-cuenta@gmail.com>"
//
// Sin SMTP configurado NO falla: muestra el mail (con el link) en la consola, para poder
// probar en la compu sin mandar nada.
//
// Las pruebas cambian el envío con Correo.usarEnvio(fn) para no mandar mails de verdad.
// =============================================================================
const nodemailer = require("nodemailer");
const { Resend } = require("resend");

let envioDePrueba = null;
let transporte = null;
let resend = null;

function hayCorreo() {
  return Boolean(
    (process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE) ||
    (process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_CLAVE)
  );
}

// Con RESEND_API_KEY puesta se manda por Resend (no por SMTP). No se mira la forma de la clave:
// las de Resend empiezan con "re_", pero si cambia el formato no queremos dejar de mandar correos
// en silencio — si la clave está mal, Resend contesta con un error claro y se ve en el log.
function hayResend() {
  return Boolean(String(process.env.RESEND_API_KEY || "").trim() && process.env.CORREO_REMITENTE);
}

function clienteResend() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

function armarTransporte() {
  if (transporte) return transporte;
  const puerto = Number(process.env.SMTP_PORT || 465);
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: { user: process.env.SMTP_USUARIO, pass: process.env.SMTP_CLAVE },
  });
  return transporte;
}

// { para, asunto, html, texto } → { ok, enConsola? }
async function enviar(mail) {
  if (envioDePrueba) return envioDePrueba(mail);

  if (!hayCorreo()) {
    console.log("\n📧 (SMTP sin configurar: el mail no sale, se muestra acá)");
    console.log("   Para:   " + mail.para);
    console.log("   Asunto: " + mail.asunto);
    console.log("   " + String(mail.texto || "").split("\n").join("\n   ") + "\n");
    return { ok: true, enConsola: true };
  }

  if (hayResend()) {
    const { error } = await clienteResend().emails.send({
      from: process.env.CORREO_REMITENTE,
      to: mail.para,
      subject: mail.asunto,
      html: mail.html,
      text: mail.texto,
    });
    if (error) throw new Error(error.message || "Resend rechazó el correo");
  } else {
    await armarTransporte().sendMail({
      from: process.env.CORREO_REMITENTE || process.env.SMTP_USUARIO,
      to: mail.para,
      subject: mail.asunto,
      html: mail.html,
      text: mail.texto,
    });
  }
  return { ok: true };
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ── Plantilla común de los mails ──
// Tabla + estilos en línea: los clientes de correo (Gmail, Outlook) ignoran <style> y flexbox.
// Fondo claro y un solo color de marca: se lee bien en cualquier bandeja, clara u oscura.
const MARCA = "#1d4ed8";

function plantilla({ preencabezado, titulo, cuerpoHtml, pie }) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(preencabezado)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="padding:0 4px 16px;font-size:15px;font-weight:700;color:#111827;letter-spacing:-.01em;">
      <span style="display:inline-block;width:22px;height:22px;border-radius:6px;background:${MARCA};vertical-align:middle;margin-right:8px;"></span><span style="vertical-align:middle;">ÑandutíHax</span>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;font-weight:700;color:#111827;">${escapar(titulo)}</h1>
      ${cuerpoHtml}
    </td></tr>
    <tr><td style="padding:16px 4px 0;font-size:12px;line-height:1.5;color:#6b7280;">
      ${pie}<br>ÑandutíHax · el host paraguayo de HaxBall
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const parrafo = (html) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${html}</p>`;

// El mail para cambiar la clave con un link (cuando te olvidaste la contraseña)
function mailRecuperar({ nick, link, minutos }) {
  const l = escapar(link);
  const html = plantilla({
    preencabezado: "Elegí una contraseña nueva para tu cuenta.",
    titulo: "Restablecer tu contraseña",
    cuerpoHtml:
      parrafo(`Hola <b>${escapar(nick)}</b>, recibimos un pedido para cambiar la contraseña de tu cuenta.`) +
      `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:8px;background:${MARCA};">
        <a href="${l}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Cambiar mi contraseña</a>
      </td></tr></table>` +
      parrafo(`El link sirve una sola vez y vence en <b>${minutos} minutos</b>.`) +
      `<p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">Si el botón no funciona, copiá este link en el navegador:<br><a href="${l}" style="color:${MARCA};word-break:break-all;">${l}</a></p>`,
    pie: "¿No pediste esto? Ignorá este correo: tu contraseña no cambia.",
  });

  const texto =
    `Hola ${nick},\n\n` +
    `Para cambiar la contraseña de tu cuenta de ÑandutíHax entrá a:\n${link}\n\n` +
    `El link sirve una sola vez y vence en ${minutos} minutos.\n` +
    `Si no fuiste vos, ignorá este correo.`;

  return { asunto: "Restablecer tu contraseña de ÑandutíHax", html, texto };
}

// El código de 6 números para cambiar la clave desde "Mi cuenta"
function mailCodigo({ nick, codigo, minutos, para = "cambiar la contraseña de tu cuenta" }) {
  const digitos = String(codigo).split("").join("&#8202;");
  const html = plantilla({
    preencabezado: `Tu código es ${codigo}. Vence en ${minutos} minutos.`,
    titulo: "Tu código de verificación",
    cuerpoHtml:
      parrafo(`Hola <b>${escapar(nick)}</b>, usá este código para ${escapar(para)}:`) +
      `<div style="margin:8px 0 24px;padding:18px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#111827;">${digitos}</div>` +
      parrafo(`Vence en <b>${minutos} minutos</b>. No se lo pases a nadie: nadie de ÑandutíHax te lo va a pedir.`),
    pie: "¿No pediste esto? Ignorá este correo y, por las dudas, cambiá tu contraseña.",
  });

  const texto =
    `Hola ${nick},\n\n` +
    `Tu código para ${para} en ÑandutíHax es: ${codigo}\n\n` +
    `Vence en ${minutos} minutos. No se lo pases a nadie.\n` +
    `Si no fuiste vos, ignorá este correo.`;

  return { asunto: `${codigo} es tu código de ÑandutíHax`, html, texto };
}

module.exports = {
  enviar,
  hayCorreo,
  mailRecuperar,
  mailCodigo,
  usarEnvio: (fn) => { envioDePrueba = fn || null; },
};
