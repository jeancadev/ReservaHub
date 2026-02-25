import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  const notes = clean(payload?.appointment?.notes, 1500);

  const dateLabel = formatDateLabel(dateIso);
  const timeLabel = formatTimeLabel(time24);

  const subject = `Nueva reservación: ${serviceName} - ${dateLabel} ${timeLabel}`.trim();

  // Determine recipients
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

  const detailHtml = detailsRows
    .filter(([_, value]) => value) // only show if value exists
    .map(([label, value]) =>
      `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;vertical-align:top;width:190px">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`)
    .join("");

  const notesHtml = model.notes
    ? `<p style="margin:14px 0 0;color:#111827;font-size:14px;line-height:1.5"><strong>Notas del cliente:</strong> ${escapeHtml(model.notes)}</p>`
    : "";

  return `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="padding:28px 28px 18px;border-bottom:1px solid #e5e7eb;background:#2563eb">
          <h1 style="margin:0;font-size:24px;line-height:1.2;color:#ffffff">¡Nueva Reservación! 🎉</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 0">
          <p style="margin:0 0 14px;font-size:16px;color:#111827">Hola,</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7">
            Se ha realizado una nueva reserva en **${escapeHtml(model.businessName)}**. 
            Por favor, revisa tu aplicación administrativa para gestionar esta nueva cita.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 0">
          <h2 style="margin:0 0 12px;font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px">Detalles de la cita</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
            ${detailHtml}
          </table>
          ${notesHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 30px">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7">
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
    model.notes ? `Notas: ${model.notes}` : "",
    "",
    "Por favor, revisa tu aplicacion para gestionar y confirmar la cita.",
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

  const resendApiKey = clean(Deno.env.get("RESEND_API_KEY"), 200);
  const fromEmail = clean(Deno.env.get("NOTIFY_FROM_EMAIL"), 254);
  if (!resendApiKey || !fromEmail) {
    return jsonResponse(500, {
      sent: false,
      reason: "missing-config",
      error: "Missing RESEND_API_KEY or NOTIFY_FROM_EMAIL env vars.",
    });
  }

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
    return jsonResponse(401, { sent: false, reason: "unauthorized", error: "Missing Authorization header in Deno." });
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
      error: `AuthError: ${clean(authError?.message, 240) || "Invalid auth session in getUser."}`,
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

  // NOTE: For notifications, the authenticated user is the CLIENT booking the appointment,
  // NOT the business. So we do NOT enforce \`(requestedBusinessId === authUser.id)\`.
  // The client is authorized to hit this endpoint for any business they are booking with.

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id,name,email,phone,role,business_name,category,address,description")
    .eq("id", requestedBusinessId)
    .maybeSingle();

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

  const resendPayload: Record<string, unknown> = {
    from: fromEmail,
    to: model.toEmails,
    subject: model.subject,
    html,
    text,
  };

  if (validEmail(model.clientEmail)) {
    resendPayload.reply_to = model.clientEmail;
  }

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(resendPayload),
  });

  const resendData = await resendResponse.json().catch(() => ({}));
  if (!resendResponse.ok) {
    return jsonResponse(502, {
      sent: false,
      reason: "provider-error",
      error: clean(resendData?.message || resendData?.error || "Email provider rejected request.", 350),
      provider: "resend",
    });
  }

  return jsonResponse(200, {
    sent: true,
    provider: "resend",
    id: clean(resendData?.id, 120) || null,
  });
});
