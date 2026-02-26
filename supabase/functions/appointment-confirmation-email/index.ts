import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import nodemailer from "npm:nodemailer@6.10.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function clean(value: unknown, maxLength = 300): string {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim();
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function categoryLabel(raw: unknown): string {
  const value = clean(raw, 40).toLowerCase();
  if (value.includes("salon")) return "Salon de belleza";
  if (value.includes("consult")) return "Consultorio";
  return "Barberia";
}

function formatDateLabel(dateIso: string): string {
  const safe = clean(dateIso, 20);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(safe);
  if (!match) return safe || "Fecha por confirmar";
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const parsed = new Date(year, month, day, 12, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return safe || "Fecha por confirmar";
  return parsed.toLocaleDateString("es-CR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(time24: string): string {
  const safe = clean(time24, 10);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(safe);
  if (!match) return safe || "Hora por confirmar";
  const hour = Number(match[1]);
  const mins = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${mins} ${suffix}`;
}

function formatPrice(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "No especificado";
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildModel(payload: any, profile: any) {
  const toEmail = clean(payload?.toEmail, 254).toLowerCase();
  const toName = clean(payload?.toName, 120) || "Cliente";

  const profileRole = clean(profile?.role, 20).toLowerCase();
  const businessName = clean(profile?.business_name, 140)
    || clean(profile?.name, 140)
    || clean(payload?.business?.name, 140)
    || "Nuestro negocio";
  const businessCategory = profileRole === "business"
    ? categoryLabel(profile?.category)
    : categoryLabel(payload?.business?.category);
  const businessPhone = clean(profile?.phone, 80) || clean(payload?.business?.phone, 80);
  const businessEmail = clean(profile?.email, 254).toLowerCase()
    || clean(payload?.business?.email, 254).toLowerCase();
  const businessAddress = clean(profile?.address, 220) || clean(payload?.business?.address, 220);
  const businessDescription = clean(profile?.description, 600) || clean(payload?.business?.description, 600);

  const serviceName = clean(payload?.appointment?.serviceName, 120) || "Servicio";
  const employeeName = clean(payload?.appointment?.employeeName, 120) || "Por asignar";
  const dateIso = clean(payload?.appointment?.date, 20);
  const time24 = clean(payload?.appointment?.time, 10);
  const duration = Number(payload?.appointment?.durationMinutes);
  const durationLabel = Number.isFinite(duration) && duration > 0 ? `${Math.round(duration)} min` : "No especificada";
  const notes = clean(payload?.appointment?.notes, 1500);
  const mapUrl = businessAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessAddress)}`
    : "";

  const dateLabel = formatDateLabel(dateIso);
  const timeLabel = formatTimeLabel(time24);
  const priceLabel = formatPrice(payload?.appointment?.price);

  const subject = `Cita confirmada en ${businessName} - ${dateLabel} ${timeLabel}`.trim();

  return {
    toEmail,
    toName,
    subject,
    businessName,
    businessCategory,
    businessPhone,
    businessEmail,
    businessAddress,
    businessDescription,
    serviceName,
    employeeName,
    dateLabel,
    timeLabel,
    durationLabel,
    priceLabel,
    notes,
    mapUrl,
  };
}

function buildText(model: ReturnType<typeof buildModel>): string {
  const lines = [
    model.businessName,
    "",
    `Estimado/a ${model.toName},`,
    "",
    "Tu cita ha sido confirmada. Estos son los detalles:",
    `Fecha: ${model.dateLabel}`,
    `Hora: ${model.timeLabel}`,
    `Servicio solicitado: ${model.serviceName}`,
    `Profesional asignado: ${model.employeeName}`,
    `Duracion estimada: ${model.durationLabel}`,
    `Monto estimado: ${model.priceLabel}`,
    `Ubicacion: ${model.businessAddress || "No especificada"}`,
    model.notes ? `Notas de tu reserva: ${model.notes}` : "",
    "",
    "Recomendaciones:",
    "- Llega 10 minutos antes de la cita.",
    "- Si necesitas cancelar o reprogramar, responde este correo o contactanos por telefono.",
    "",
    "Contacto del negocio:",
    model.businessPhone ? `Telefono: ${model.businessPhone}` : "",
    model.businessEmail ? `Correo: ${model.businessEmail}` : "",
    model.mapUrl ? `Mapa: ${model.mapUrl}` : "",
    "",
    "Gracias por confiar en nosotros.",
    `Equipo de ${model.businessName}`,
  ].filter(Boolean);

  return lines.join("\n");
}

function buildHtml(model: ReturnType<typeof buildModel>): string {
  const detailsRows = [
    ["Fecha", model.dateLabel],
    ["Hora", model.timeLabel],
    ["Servicio solicitado", model.serviceName],
    ["Profesional asignado", model.employeeName],
    ["Duracion estimada", model.durationLabel],
    ["Monto estimado", model.priceLabel],
    ["Ubicacion", model.businessAddress || "No especificada"],
  ];

  const detailHtml = detailsRows
    .map(([label, value]) =>
      `<tr>
         <td class="mobile-cell label-cell" style="padding:10px 14px 2px 0;color:#6b7280;font-size:14px;vertical-align:top;width:40%;word-wrap:break-word;">
           ${escapeHtml(label)}
         </td>
         <td class="mobile-cell value-cell" style="padding:10px 0 10px 0;color:#111827;font-size:14px;font-weight:600;vertical-align:top;word-wrap:break-word;">
           ${escapeHtml(value)}
         </td>
       </tr>`)
    .join("");

  const notesHtml = model.notes
    ? `<div style="margin-top:16px;background:#f9fafb;padding:14px;border-radius:8px;border:1px solid #e5e7eb;">
         <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;word-wrap:break-word;">
           <strong style="display:block;margin-bottom:4px;color:#374151">Notas de tu reserva:</strong> 
           ${escapeHtml(model.notes)}
         </p>
       </div>`
    : "";

  const mapHtml = model.mapUrl
    ? `<p style="margin:12px 0 0"><a href="${escapeHtml(model.mapUrl)}" style="display:inline-block;padding:8px 16px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">📍 Ver en Google Maps</a></p>`
    : "";

  const descriptionHtml = model.businessDescription
    ? `<p style="margin:12px 0 0;color:#6b7280;font-size:14px;line-height:1.5;word-wrap:break-word;">${escapeHtml(model.businessDescription)}</p>`
    : "";

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(model.subject)}</title>
    <style>
      @media screen and (max-width: 480px) {
        .mobile-container { padding: 12px !important; }
        .card { border-radius: 8px !important; }
        .mobile-padding { padding: 20px 16px !important; }
        .header-padding { padding: 24px 16px 16px !important; }
        .mobile-cell {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        .label-cell {
          padding: 12px 0 4px 0 !important;
          font-weight: 500 !important;
          border-top: 1px solid #f3f4f6 !important;
        }
        .value-cell {
          padding: 0 0 12px 0 !important;
        }
        h1 { font-size: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;" class="mobile-container">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;" class="card">
      <tr>
        <td style="padding:32px 32px 20px;border-bottom:1px solid #e5e7eb;" class="header-padding">
          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#111827">${escapeHtml(model.businessName)}</h1>
          <p style="margin:6px 0 0;color:#6b7280;font-size:14px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(model.businessCategory)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;" class="mobile-padding">
          <p style="margin:0 0 14px;font-size:16px;color:#111827">Estimado/a <strong>${escapeHtml(model.toName)}</strong>,</p>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.6">
            Hemos confirmado tu cita. Gracias por elegirnos. Aquí tienes la información completa para que llegues preparado/a:
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 0;" class="mobile-padding">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:0 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">
              ${detailHtml}
            </table>
          </div>
          ${notesHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;" class="mobile-padding">
          <div style="background:#ecfeff;border-left:4px solid #06b6d4;padding:16px;">
            <p style="margin:0 0 10px;color:#0f172a;font-size:14px;line-height:1.5">
              <strong>💡 Recomendación:</strong> Llega al menos 10 minutos antes para atenderte con calma y puntualidad.
            </p>
            <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.5">
              Si necesitas cancelar o reprogramar, por favor contáctanos con anticipación.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;" class="mobile-padding">
          <h2 style="margin:0 0 12px;font-size:18px;color:#111827">Contacto del negocio</h2>
          <div style="background:#f9fafb;padding:16px;border-radius:8px;">
            ${model.businessPhone ? `<p style="margin:0 0 8px;color:#374151;font-size:14px;word-wrap:break-word;"><strong>📞 Teléfono:</strong> ${escapeHtml(model.businessPhone)}</p>` : ""}
            ${model.businessEmail ? `<p style="margin:0 0 8px;color:#374151;font-size:14px;word-wrap:break-word;"><strong>✉️ Correo:</strong> <a href="mailto:${escapeHtml(model.businessEmail)}" style="color:#2563eb;text-decoration:none">${escapeHtml(model.businessEmail)}</a></p>` : ""}
            ${model.businessAddress ? `<p style="margin:0;color:#374151;font-size:14px;line-height:1.5;word-wrap:break-word;"><strong>🏢 Dirección:</strong> ${escapeHtml(model.businessAddress)}</p>` : ""}
          </div>
          ${mapHtml}
          ${descriptionHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:32px;text-align:center;border-top:1px solid #e5e7eb;margin-top:24px;" class="mobile-padding">
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">
            Gracias por tu confianza.<br>
            <strong style="color:#111827;display:inline-block;margin-top:4px;">Equipo de ${escapeHtml(model.businessName)}</strong>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { sent: false, error: "Method not allowed" });
  }

  // ── Gmail SMTP config ────────────────────────────────────────────────────
  const gmailUser = clean(Deno.env.get("GMAIL_USER"), 254);
  const gmailAppPassword = clean(Deno.env.get("GMAIL_APP_PASSWORD"), 200);
  if (!gmailUser || !gmailAppPassword) {
    return jsonResponse(500, {
      sent: false,
      reason: "missing-config",
      error: "Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars.",
    });
  }

  // ── Supabase auth ────────────────────────────────────────────────────────
  const supabaseUrl = clean(Deno.env.get("SUPABASE_URL"), 200);
  const supabaseAnonKey = clean(Deno.env.get("SUPABASE_ANON_KEY"), 220);
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(500, {
      sent: false,
      reason: "missing-config",
      error: "Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars.",
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(401, { sent: false, reason: "unauthorized", error: "Missing Authorization header." });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const authUser = authData && authData.user ? authData.user : null;
  if (authError || !authUser) {
    return jsonResponse(401, {
      sent: false,
      reason: "unauthorized",
      error: `AuthError: ${clean(authError?.message, 240) || "Invalid auth session."}`,
      details: authError
    });
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse(400, { sent: false, reason: "invalid-payload", error: "Invalid JSON body." });
  }

  const requestedBusinessId = clean(payload?.business?.id, 80);
  if (!requestedBusinessId) {
    return jsonResponse(400, {
      sent: false,
      reason: "invalid-payload",
      error: "Missing business.id in payload.",
    });
  }

  if (requestedBusinessId !== authUser.id) {
    return jsonResponse(403, {
      sent: false,
      reason: "forbidden",
      error: "You can only send notifications for your own business.",
    });
  }

  const toEmail = clean(payload?.toEmail, 254).toLowerCase();
  if (!toEmail || !validEmail(toEmail)) {
    return jsonResponse(400, {
      sent: false,
      reason: "invalid-recipient",
      error: "Client email is missing or invalid.",
    });
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id,name,email,phone,role,business_name,category,address,description")
    .eq("id", authUser.id)
    .maybeSingle();

  const model = buildModel(payload, profileRow || {});
  if (!validEmail(model.toEmail)) {
    return jsonResponse(400, {
      sent: false,
      reason: "invalid-recipient",
      error: "Client email is invalid.",
    });
  }

  const html = buildHtml(model);
  const text = buildText(model);

  // ── Envío via Gmail SMTP con Nodemailer ──────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });

  const mailOptions: Record<string, unknown> = {
    from: `"${model.businessName}" <${gmailUser}>`,
    to: model.toEmail,
    subject: model.subject,
    html,
    text,
  };

  if (validEmail(model.businessEmail) && model.businessEmail !== gmailUser) {
    mailOptions.replyTo = model.businessEmail;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return jsonResponse(200, {
      sent: true,
      provider: "gmail-smtp",
      id: clean(info?.messageId, 200) || null,
    });
  } catch (err: any) {
    return jsonResponse(502, {
      sent: false,
      reason: "provider-error",
      error: clean(err?.message || "Gmail SMTP rejected the request.", 350),
      provider: "gmail-smtp",
    });
  }
});
