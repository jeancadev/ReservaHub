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
      `<tr><td style="padding:8px 0;color:#6b7280;font-size:14px;vertical-align:top;width:190px">${escapeHtml(label)}</td><td style="padding:8px 0;color:#111827;font-size:14px;font-weight:600">${escapeHtml(value)}</td></tr>`)
    .join("");

  const notesHtml = model.notes
    ? `<p style="margin:14px 0 0;color:#111827;font-size:14px;line-height:1.5"><strong>Notas de tu reserva:</strong> ${escapeHtml(model.notes)}</p>`
    : "";

  const mapHtml = model.mapUrl
    ? `<p style="margin:10px 0 0"><a href="${escapeHtml(model.mapUrl)}" style="color:#0f766e;text-decoration:none;font-weight:600">Ver ubicacion en Google Maps</a></p>`
    : "";

  const descriptionHtml = model.businessDescription
    ? `<p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5">${escapeHtml(model.businessDescription)}</p>`
    : "";

  return `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
      <tr>
        <td style="padding:28px 28px 18px;border-bottom:1px solid #e5e7eb">
          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#111827">${escapeHtml(model.businessName)}</h1>
          <p style="margin:8px 0 0;color:#6b7280;font-size:14px">${escapeHtml(model.businessCategory)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 0">
          <p style="margin:0 0 14px;font-size:16px;color:#111827">Estimado/a ${escapeHtml(model.toName)},</p>
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7">
            Hemos confirmado tu cita. Gracias por elegirnos. Aqui tienes la informacion completa para que llegues preparado/a:
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 0">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
            ${detailHtml}
          </table>
          ${notesHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0">
          <div style="background:#ecfeff;border:1px solid #99f6e4;border-radius:10px;padding:14px 16px">
            <p style="margin:0 0 10px;color:#0f172a;font-size:14px;line-height:1.6">
              <strong>Recomendacion:</strong> Llega al menos 10 minutos antes para atenderte con calma y puntualidad.
            </p>
            <p style="margin:0;color:#0f172a;font-size:14px;line-height:1.6">
              Si necesitas cancelar o reprogramar, por favor contactanos con anticipacion para ayudarte.
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px 0">
          <h2 style="margin:0 0 8px;font-size:16px;color:#111827">Contacto del negocio</h2>
          ${model.businessPhone ? `<p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Telefono:</strong> ${escapeHtml(model.businessPhone)}</p>` : ""}
          ${model.businessEmail ? `<p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Correo:</strong> ${escapeHtml(model.businessEmail)}</p>` : ""}
          ${model.businessAddress ? `<p style="margin:0 0 6px;color:#374151;font-size:14px"><strong>Direccion:</strong> ${escapeHtml(model.businessAddress)}</p>` : ""}
          ${mapHtml}
          ${descriptionHtml}
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px 30px">
          <p style="margin:0;color:#374151;font-size:14px;line-height:1.7">
            Gracias por tu confianza.<br>
            <strong>Equipo de ${escapeHtml(model.businessName)}</strong>
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

  const resendPayload: Record<string, unknown> = {
    from: fromEmail,
    to: [model.toEmail],
    subject: model.subject,
    html,
    text,
  };

  if (validEmail(model.businessEmail)) {
    resendPayload.reply_to = model.businessEmail;
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
