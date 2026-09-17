// =============================================================================
// Correo — manda los mails de Ñandutí Web (por ahora: recuperar la cuenta).
//
// Va por SMTP con nodemailer. Se configura en .env:
//
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465                 465 = SSL · 587 = STARTTLS
//   SMTP_USUARIO=tu-cuenta@gmail.com
//   SMTP_CLAVE=xxxx xxxx xxxx xxxx  con Gmail: una "contraseña de aplicación", no tu clave normal
//   CORREO_REMITENTE="ÑandutíBall <tu-cuenta@gmail.com>"
//
// Sin SMTP configurado NO falla: muestra el mail (con el link) en la consola, para poder
// probar en la compu sin mandar nada.
//
// Las pruebas cambian el envío con Correo.usarEnvio(fn) para no mandar mails de verdad.
// =============================================================================
const nodemailer = require("nodemailer");

let envioDePrueba = null;
let transporte = null;

function hayCorreo() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USUARIO && process.env.SMTP_CLAVE);
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

  await armarTransporte().sendMail({
    from: process.env.CORREO_REMITENTE || process.env.SMTP_USUARIO,
    to: mail.para,
    subject: mail.asunto,
    html: mail.html,
    text: mail.texto,
  });
  return { ok: true };
}

const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// El mail para cambiar la clave. HTML con estilos en línea: los clientes de correo ignoran <style>.
function mailRecuperar({ nick, link, minutos }) {
  const n = escapar(nick);
  const l = escapar(link);
  const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#0f1720;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1720;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#17222e;border-radius:14px;overflow:hidden;">
    <tr><td style="background:#d52b1e;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 8px;color:#ffffff;font-size:22px;font-weight:bold;">🕸️ Ñandutí Web</td></tr>
    <tr><td style="padding:8px 28px;color:#dfe7ee;font-size:15px;line-height:1.55;">
      Hola <b>${n}</b>,<br><br>
      Nos pediste cambiar la contraseña de tu cuenta de ÑandutíBall. Tocá el botón para elegir una nueva:
    </td></tr>
    <tr><td align="center" style="padding:22px 28px;">
      <a href="${l}" style="display:inline-block;background:#00c853;color:#0f1720;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 28px;border-radius:10px;">Cambiar mi contraseña</a>
    </td></tr>
    <tr><td style="padding:0 28px 8px;color:#93a1b0;font-size:13px;line-height:1.5;">
      El link sirve una sola vez y vence en <b>${minutos} minutos</b>.<br>
      Si el botón no anda, copiá esto en el navegador:<br>
      <a href="${l}" style="color:#6fb3ff;word-break:break-all;">${l}</a>
    </td></tr>
    <tr><td style="padding:16px 28px 28px;color:#93a1b0;font-size:13px;line-height:1.5;border-top:1px solid #243242;">
      ¿No fuiste vos? Ignorá este correo: tu contraseña sigue igual.
    </td></tr>
    <tr><td style="background:#0038a8;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>
</table>
</body></html>`;

  const texto =
    `Hola ${nick},\n\n` +
    `Para cambiar la contraseña de tu cuenta de ÑandutíBall entrá a:\n${link}\n\n` +
    `El link sirve una sola vez y vence en ${minutos} minutos.\n` +
    `Si no fuiste vos, ignorá este correo.`;

  return { asunto: "🕸️ Cambiá tu contraseña de ÑandutíBall", html, texto };
}

module.exports = {
  enviar,
  hayCorreo,
  mailRecuperar,
  usarEnvio: (fn) => { envioDePrueba = fn || null; },
};
