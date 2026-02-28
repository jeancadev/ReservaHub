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
  const clientEmail = clean(payload?.client?.email, 254).toLowerCase();
  const clientName = clean(payload?.client?.name, 120) || "Cliente";
  const clientPhone = clean(payload?.client?.phone, 80) || "No especificado";

  const businessName = clean(profile?.business_name, 140)
    || clean(profile?.name, 140)
    || clean(payload?.business?.name, 140)
    || "Tu negocio";
  const businessEmail = clean(profile?.email, 254).toLowerCase()
    || clean(payload?.business?.email, 254).toLowerCase();

  const employeeEmail = clean(payload?.employee?.email, 254).toLowerCase();

  const serviceName = clean(payload?.appointment?.serviceName, 120) || "Servicio";
  const employeeName = clean(payload?.appointment?.employeeName, 120) || "Por asignar";
  const dateIso = clean(payload?.appointment?.date, 20);
  const time24 = clean(payload?.appointment?.time, 10);
  const duration = Number(payload?.appointment?.durationMinutes);
  const durationLabel = Number.isFinite(duration) && duration > 0 ? `${Math.round(duration)} min` : "No especificada";
  const price = Number(payload?.appointment?.price);
  const priceLabel = formatPrice(price);
  const prepaymentRequired = !!payload?.appointment?.prepaymentRequired;
  const rawPrepaymentRate = Number(payload?.appointment?.prepaymentRate);
  const prepaymentRate = Number.isFinite(rawPrepaymentRate) && rawPrepaymentRate > 0 ? rawPrepaymentRate : 0.4;
  const prepaymentPercentLabel = `${Math.round(prepaymentRate * 100)}%`;
  const rawPrepaymentAmount = Number(payload?.appointment?.prepaymentAmount);
  const prepaymentAmount = Number.isFinite(rawPrepaymentAmount) && rawPrepaymentAmount > 0
    ? rawPrepaymentAmount
    : (Number.isFinite(price) && price > 0 ? Math.round(price * prepaymentRate) : 0);
  const prepaymentAmountLabel = prepaymentAmount > 0 ? formatPrice(prepaymentAmount) : "";
  const prepaymentPhone = clean(payload?.appointment?.prepaymentPhone, 40)
    || clean(payload?.appointment?.prepaymentReceiptPhone, 40);
  const prepaymentStatusRaw = clean(payload?.appointment?.prepaymentStatus, 30).toLowerCase();
  const prepaymentStatus = !prepaymentRequired
    ? ""
    : (prepaymentStatusRaw === "received" ? "Recibido" : "Pendiente");
  const notes = clean(payload?.appointment?.notes, 1500);

  const dateLabel = formatDateLabel(dateIso);
  const timeLabel = formatTimeLabel(time24);

  const subject = `Nueva reservación: ${serviceName} - ${dateLabel} ${timeLabel}`.trim();

  // Determine recipients (business owner and/or employee)
  const toEmails = new Set<string>();
  if (validEmail(businessEmail)) toEmails.add(businessEmail);
  if (validEmail(employeeEmail)) toEmails.add(employeeEmail);

  return {
    clientEmail,
    clientName,
    clientPhone,
    subject,
    businessName,
    businessEmail,
    employeeEmail,
    serviceName,
    employeeName,
    dateLabel,
    timeLabel,
    durationLabel,
    priceLabel,
    prepaymentRequired,
    prepaymentPercentLabel,
    prepaymentAmountLabel,
    prepaymentPhone,
    prepaymentStatus,
    notes,
    toEmails: Array.from(toEmails),
  };
}

function buildHtml(model: ReturnType<typeof buildModel>): string {
  const detailsRows = [
    ["Cliente", model.clientName],
    ["Teléfono", model.clientPhone],
    ["Correo", model.clientEmail],
    ["Fecha", model.dateLabel],
    ["Hora", model.timeLabel],
    ["Servicio", model.serviceName],
    ["Profesional", model.employeeName],
    ["Duración", model.durationLabel],
  ];

  detailsRows.push(["Monto estimado", model.priceLabel]);
  if (model.prepaymentRequired) {
    detailsRows.push(
      ["Adelanto requerido", model.prepaymentAmountLabel || model.prepaymentPercentLabel],
      ["Porcentaje de adelanto", model.prepaymentPercentLabel],
      ["Estado de adelanto", model.prepaymentStatus || "Pendiente"],
    );
    if (model.prepaymentPhone) {
      detailsRows.push(["SINPE / WhatsApp", model.prepaymentPhone]);
    }
  }

  const detailHtml = detailsRows
    .filter(([_, value]) => value)
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
           <strong style="display:block;margin-bottom:4px;color:#374151">Notas del cliente:</strong> 
           ${escapeHtml(model.notes)}
         </p>
       </div>`
    : "";

  const prepaymentHtml = model.prepaymentRequired
    ? `<div style="margin-top:16px;background:#fffbeb;padding:14px;border-radius:8px;border:1px solid #facc15;">
         <p style="margin:0;color:#854d0e;font-size:14px;line-height:1.6;word-wrap:break-word;">
           <strong style="display:block;margin-bottom:4px;color:#713f12">Adelanto requerido para confirmar:</strong>
           Solicita y valida ${escapeHtml(model.prepaymentAmountLabel || model.prepaymentPercentLabel)} por SINPE Movil${model.prepaymentPhone ? ` al ${escapeHtml(model.prepaymentPhone)}` : ""} antes de confirmar la cita.
         </p>
       </div>`
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
        <td style="padding:32px 32px 20px;border-bottom:1px solid #e5e7eb;background:#2563eb;" class="header-padding">
          <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff">¡Nueva Reservación! 🎉</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 0;" class="mobile-padding">
          <p style="margin:0 0 14px;font-size:16px;color:#111827">Hola,</p>
          <p style="margin:0;color:#374151;font-size:15px;line-height:1.6">
            Se ha realizado una nueva reserva en <strong>${escapeHtml(model.businessName)}</strong>.
            Por favor, revisa tu aplicación administrativa para gestionar esta nueva cita.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 0;" class="mobile-padding">
          <h2 style="margin:0 0 14px;font-size:18px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:10px">Detalles de la cita</h2>
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:0 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;table-layout:fixed;">
              ${detailHtml}
            </table>
          </div>
          ${notesHtml}
          ${prepaymentHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:32px;text-align:center;border-top:1px solid #e5e7eb;margin-top:24px;" class="mobile-padding">
          <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.6">
            Este es un correo automático generado por el sistema de reservas.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

function buildText(model: ReturnType<typeof buildModel>): string {
  const lines = [
    "¡NUEVA RESERVACIÓN!",
    "",
    `Se ha realizado una nueva reserva en ${model.businessName}.`,
    "",
    "DETALLES DE LA CITA:",
    `Cliente: ${model.clientName}`,
    `Teléfono: ${model.clientPhone}`,
    `Correo: ${model.clientEmail}`,
    `Fecha: ${model.dateLabel}`,
    `Hora: ${model.timeLabel}`,
    `Servicio: ${model.serviceName}`,
    `Profesional: ${model.employeeName}`,
    `Duracion: ${model.durationLabel}`,
    `Monto estimado: ${model.priceLabel}`,
    model.prepaymentRequired ? `Adelanto requerido (${model.prepaymentPercentLabel}): ${model.prepaymentAmountLabel || model.prepaymentPercentLabel}` : "",
    model.prepaymentRequired ? `Estado de adelanto: ${model.prepaymentStatus || "Pendiente"}` : "",
    model.prepaymentRequired ? `SINPE / WhatsApp para comprobante: ${model.prepaymentPhone || "No especificado"}` : "",
    model.notes ? `Notas: ${model.notes}` : "",
    "",
    model.prepaymentRequired
      ? "Confirma la cita solo despues de validar el comprobante de adelanto."
      : "Por favor, revisa tu aplicacion para gestionar y confirmar la cita.",
  ].filter(Boolean);

  return lines.join("\n");
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

  // ── Supabase (solo para leer el perfil del negocio) ──────────────────────
  const supabaseUrl = clean(Deno.env.get("SUPABASE_URL"), 200);
  const supabaseServiceKey = clean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), 300);
  const supabaseAnonKey = clean(Deno.env.get("SUPABASE_ANON_KEY"), 220);

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

  // NOTE: This function is called by the CLIENT booking the appointment.
  // No JWT verification needed — it's deployed with --no-verify-jwt.
  // We look up the business profile using the service role key (read-only).
  let profileRow: any = null;
  try {
    if (supabaseUrl && (supabaseServiceKey || supabaseAnonKey)) {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
      const adminClient = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
      const { data } = await adminClient
        .from("profiles")
        .select("id,name,email,phone,role,business_name,category,address,description")
        .eq("id", requestedBusinessId)
        .maybeSingle();
      profileRow = data;
    }
  } catch {
    // Continue without profile row - we'll use payload data
  }

  const model = buildModel(payload, profileRow || {});

  if (model.toEmails.length === 0) {
    return jsonResponse(400, {
      sent: false,
      reason: "invalid-recipient",
      error: "No valid business or employee email found to notify.",
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
    to: model.toEmails.join(", "),
    subject: model.subject,
    html,
    text,
  };

  if (validEmail(model.clientEmail)) {
    mailOptions.replyTo = model.clientEmail;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return jsonResponse(200, {
      sent: true,
      provider: "gmail-smtp",
      id: clean(info?.messageId, 200) || null,
      recipients: model.toEmails,
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
