# ReservaHub - Sistema Profesional de Gestión de Citas 📅

[![ReservaHub](https://img.shields.io/badge/Status-Active-success.svg)](#)
[![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)](#)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-%233ECF8E?logo=supabase&logoColor=white)](#)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel)](#)

👉 **[Ver proyecto en vivo (Vercel)](https://reservatucita.vercel.app/)**

**ReservaHub** es una aplicación web moderna y profesional diseñada para la gestión integral de citas y turnos. Ideal para barberías, consultorios, clínicas dentales y spas. El sistema permite administrar clientes, empleados, servicios y horarios, ofreciendo además una interfaz dedicada para que los clientes reserven sus propias citas.

---

## 🌐 Demo en Vivo

Puedes explorar y probar la aplicación desplegada en Vercel visitando el siguiente enlace:
**[https://reservatucita.vercel.app/](https://reservatucita.vercel.app/)**

---

## 🚀 Características Principales

### Para Negocios 🏢
- **Panel de Control (Dashboard):** Métricas clave en tiempo real (citas del día, ingresos, ocupación) y gráficas interactivas.
- **Calendario Interactivo:** Vista centralizada de la agenda, con filtros por profesional y alta de nuevas citas de forma rápida.
- **Gestión de Clientes:** Base de datos con historial de visitas, contacto y estadísticas individuales.
- **Gestión de Empleados y Servicios:** Configuración de profesionales y catálogo de servicios con duraciones y precios.
- **Reportes y Analíticas:** Visualización de ingresos, servicios populares y posibilidad de exportar datos a Excel.
- **Configuraciones Avanzadas:** Horarios de atención, límites de agenda, ventana de reservas y personalización del perfil del negocio.

### Para Clientes 👤
- **Portal de Auto-reserva:** Vista optimizada para que los clientes soliciten citas según la disponibilidad del negocio.
- **Historial de Citas:** Visualización de citas pasadas y próximas.
- **Gestión de Perfil:** Actualización fácil de datos de contacto.

### Generales ⚙️
- **Autenticación Segura:** Registro e inicio de sesión por roles (Negocio / Cliente) y recuperación de contraseña.
- **Notificaciones Integradas:** Sistema de alertas In-App y notificaciones por correo electrónico (vía Supabase Edge Functions).
- **Diseño Responsivo (Mobile-First):** Experiencia fluida en cualquier dispositivo (móvil, tablet, escritorio).
- **Modo Claro / Oscuro:** Soporte nativo y rápido para cambiar el tema de la aplicación.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:**
  - HTML5 & CSS3 (Estilos Vanilla con variables CSS).
  - JavaScript (Vanilla, arquitectura modular: `app.js`, `auth.js`, `ui.js`, `calendar.js`, etc.).
  - [Chart.js](https://www.chartjs.org/) para reportes y gráficas.
  - [SheetJS (xlsx-js-style)](https://sheetjs.com/) para exportación a Excel.
  - [FontAwesome](https://fontawesome.com/) para iconografía.
- **Backend (BaaS):**
  - [Supabase](https://supabase.com/).
  - PostgreSQL (Base de datos relacional y funciones SQL avanzadas).
  - Supabase Auth (Autenticación y roles en RLS).
  - Supabase Storage (Almacenamiento de avatares e imágenes).
  - Supabase Edge Functions (Deno/TypeScript) para el envío de correos.

---

## 📂 Estructura del Proyecto

```text
├── css/
│   └── styles.css               # Estilos globales y variables de diseño
├── js/
│   ├── app.js                   # Inicialización y enrutamiento principal
│   ├── appointments.js          # Lógica de citas
│   ├── auth.js                  # Lógica de autenticación
│   ├── calendar.js              # Renderizado y lógica del calendario
│   ├── clients.js               # Controlador de clientes
│   ├── dashboard.js             # Gráficas y métricas del negocio
│   ├── notifications.js         # Panel de notificaciones In-App
│   ├── reports.js               # Análisis y exportación a Excel
│   ├── services-employees.js    # ABM de Servicios y Empleados
│   ├── settings-clientview.js   # Configuraciones de negocio y vistas del cliente
│   ├── supabase-backend.js      # Conexión principal con la DB y Auth
│   └── ui.js                    # Controladores de la interfaz de usuario (Modal, Sidebar)
├── supabase/
│   ├── functions/               # Edge Functions (Ej. confirmación de reserva)
│   └── SUPABASE_SETUP.sql       # Script SQL para creación de tablas, triggers y RLS
├── favicon.svg                  # Icono de la aplicación
└── index.html                   # Entry point de la aplicación (SPA Shell)
```

---

## ⚙️ Configuración e Instalación

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/reservahub.git
   ```

2. **Configuración de Supabase:**
   - Crea un nuevo proyecto en [Supabase](https://supabase.com).
   - Ejecuta el script incluido `SUPABASE_SETUP.sql` en el SQL Editor de tu proyecto para crear las tablas (`profiles`, `app_state`), el bucket `reservahub-media` y las políticas de seguridad (RLS).
   - Configura las credenciales en tu entorno local (actualiza las variables de conexión en `js/supabase-backend.js` o asegúrate de cargarlas de forma segura, actualmente integradas para MVP).

3. **Despliegue de Edge Functions:**
   Para las notificaciones por correo, instala la CLI de Supabase y despliega las funciones:
   ```bash
   supabase functions deploy appointment-confirmation-email
   ```
   No olvides configurar los _secrets_ en Supabase (ej. `RESEND_API_KEY`).

4. **Ejecución Local:**
   Puedes utilizar cualquier servidor de desarrollo estático, por ejemplo [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) en VS Code, o mediante Node:
   ```bash
   npx serve .
   ```

---

## 👨‍💻 Autor

**Jean Carlos Obando**
- 📧 [jean.obandocortes@gmail.com](mailto:jean.obandocortes@gmail.com)
- 🐙 [GitHub](https://github.com/jeancadev)
- 💼 [LinkedIn](https://www.linkedin.com/in/jeancarlosobando)

---

*Desarrollado con ❤️ para empoderar a los pequeños y medianos negocios.*
