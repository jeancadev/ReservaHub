# Appointment Confirmation Email Function

Edge Function usada por la app para enviar correo cuando una cita pasa a estado `confirmed`.

## Variables de entorno requeridas

- `RESEND_API_KEY`: API key de Resend.
- `NOTIFY_FROM_EMAIL`: correo remitente verificado en Resend (ej: `Barberia <no-reply@tu-dominio.com>`).

## Deploy

```bash
supabase functions deploy appointment-confirmation-email
```

## Invocacion desde la app

La app la invoca automaticamente con:

```js
App.backend.client.functions.invoke('appointment-confirmation-email', { body: payload })
```

Si la funcion no esta desplegada o no hay configuracion, la cita se confirma igualmente y la app muestra aviso.
