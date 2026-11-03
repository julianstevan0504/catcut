# Cerca · Tu tienda, siempre cerca

**[Descargar la plataforma completa en ZIP](https://github.com/julianstevan0504/catcut/raw/refs/heads/entrega-cerca-whatsapp/descargas/Cerca-WhatsApp.zip)**

**Versión 2.0:** descomprime el ZIP y abre **index.html** en la carpeta principal. Se abre una demo interactiva con productos, pedidos, conversaciones, importación CSV, búsqueda, modo oscuro y simulador. **La demo no necesita Node.js ni servidor.** Para trabajar con cuentas reales y WhatsApp, usa el iniciador del servidor con Node.js 24 o superior.

Plataforma en español para una tienda independiente en Colombia. Incluye registro e inicio de sesión, bandeja de conversaciones, inventario, seguimiento de pedidos, configuración del asistente y registro de actividad. React + TypeScript + Vite, servidor Express y base de datos SQLite persistente. Requiere **Node.js 24 o superior**.

## Probar en desarrollo

### Abrir la demo con doble clic

El `index.html` de la carpeta principal del ZIP contiene toda la demo en un único archivo, incluidos scripts, estilos y tipografía. También puedes abrir `Cerca.html`. Las pruebas se conservan en el almacenamiento de ese navegador cuando está disponible; no se guardan contraseñas ni credenciales reales. La demo es local y no envía WhatsApp. En **Configuración → Datos y seguridad** puedes exportar tus pruebas y reiniciarla.

El `index.html` del código de desarrollo redirige a `Cerca.html` cuando lo abres como archivo local. En una dirección HTTP ejecuta la aplicación con servidor. La pantalla inicial ofrece recuperación e instrucciones si algo no carga. `ABRIR_PRIMERO.html`, en el ZIP, también explica las dos modalidades.

### Iniciar la aplicación con servidor

El ZIP incluye `dist/` ya compilado. Con Node instalado, puedes usar el iniciador de Windows, Mac o Linux de la carpeta principal. También puedes entrar a `proyecto/` y ejecutar `node scripts/start-local.mjs`. El iniciador instala las dependencias cuando hace falta, espera a que el servidor esté listo y abre el navegador. No publiques esta modalidad de demo local como servidor de producción.

El iniciador escucha solo en la interfaz local del computador. Para recibir mensajes reales necesitas publicar el servidor con HTTPS. Los datos del servidor se guardan en SQLite y están separados de los datos de la demo del navegador.

```bash
npm ci
cp .env.example .env
npm run dev
```

El cliente usa el puerto 5173 y el servidor, el 3000. Abre el cliente en tu navegador. Puedes **Explorar la demo** (Luna Store, datos ficticios) o **Crear tu cuenta** para empezar con una tienda vacía. No hace falta conectar servicios externos para usar el panel y el simulador.

La cuenta de ejemplo del servidor es compartida y tampoco acepta credenciales reales. La demo independiente pertenece a tu navegador. Las cuentas reales nuevas tienen datos aislados y no se crean contraseñas predeterminadas. Usa la máquina aislada y el checkout existente; no necesitas un worktree adicional.

## Qué puedes hacer

- Crear una cuenta, iniciar/cerrar sesión y cambiar la contraseña. El registro puede cerrarse después de la primera cuenta propietaria.
- Ver las conversaciones y el historial de respuestas. Tomar el control para pausar el bot en un chat, responder manualmente, devolverlo al asistente o marcarlo como resuelto.
- Agregar, editar y eliminar productos con precios en COP y unidades disponibles. El stock se mantiene manualmente; las consultas no reservan ni descuentan unidades.
- Registrar pedidos, actualizar su estado y agregar la guía y un enlace HTTPS de seguimiento. No consulta transportadoras ni tiendas externas automáticamente.
- Configurar nombre, bienvenida, tono, horarios, envíos, cambios, pagos y preguntas frecuentes.
- Probar consultas sin enviar mensajes reales. El simulador representa el número **+573001112233**; un pedido de prueba debe usar ese número para poder consultarlo.
- Revisar accesos, cambios, respuestas y errores en el registro de actividad. El panel y su exportación muestran los últimos 200 eventos; la base guarda el historial completo.
- Exportar conversaciones, pedidos y actividad a CSV.
- Importar hasta 500 productos desde CSV de Excel o Google Sheets, con plantilla, vista previa, validación y opción explícita de actualizar SKU existentes. Las importaciones en el servidor se guardan en una transacción: un error revierte el lote completo.
- Exportar el catálogo, filtrar stock y buscar productos, pedidos y conversaciones con **Ctrl+K / ⌘+K**.
- Cambiar entre modo claro y oscuro y usar formularios con tamaños adecuados para celular.
- Consultar y revocar sesiones de otros dispositivos. Exportar los datos de tu tienda a JSON sin credenciales.

## Seguridad y sesiones

Las cuentas del servidor usan scrypt para las contraseñas y tokens de sesión aleatorios que se guardan como hashes. En producción la cookie usa el prefijo `__Host-`, `Secure`, `HttpOnly`, `SameSite=Lax` y ninguna propiedad Domain. Las sesiones caducan a los siete días o tras 24 horas sin actividad.

Las acciones autenticadas de escritura requieren `X-CSRF-Token`. El cliente lo obtiene al iniciar sesión o consultar `/api/me`. Un cliente externo debe conservar la cookie y usar el token de esa misma sesión. Los webhooks de Meta usan firma HMAC y no necesitan ese token.

Las respuestas HTML del servidor no se almacenan en caché y cada respuesta tiene un nonce distinto en su política CSP. En desarrollo no se fuerza la actualización de recursos locales a HTTPS. Los valores de contraseñas conservan sus espacios; las credenciales de Meta se cifran con AES-256-GCM. Los cambios y accesos quedan en el registro.

El servidor limita intentos de acceso, cambios de contraseña y exportaciones. SQLite se crea con permisos restrictivos. `TRUST_PROXY=1` debe usarse solo detrás de un proxy de confianza; el blueprint de Render lo configura. No son pruebas de penetración ni una garantía de ausencia de vulnerabilidades: las pruebas automatizadas verifican los casos que se incluyen en `tests/`.

## Asistente local e IA generativa

Sin credenciales, el asistente local responde en español con las políticas y los datos del catálogo y pedidos. Es un asistente basado en reglas: no equivale a un modelo generativo y el selector de tono solo afecta a las respuestas generadas por IA. La interfaz lo distingue como **Asistente local**.

Para activar OpenAI, configura en el entorno del servidor:

```dotenv
OPENAI_API_KEY=<configurar como secreto en el alojamiento>
OPENAI_MODEL=gpt-4.1-mini
```

La IA usa la Responses API con herramientas para consultar la tienda, el stock y el pedido autorizado. No puede efectuar compras, modificar precios ni reservar inventario. Se envían hasta los últimos 12 mensajes y la información necesaria de la tienda al proveedor, con `store: false`. Informa a tus clientes del tratamiento de sus conversaciones. Si el proveedor falla, se utiliza el asistente local y se registra el cambio. Los mocks de las pruebas no validan la respuesta de un modelo real: eso requiere una clave válida.

El seguimiento solo devuelve pedidos del número remitente proporcionado por WhatsApp, aunque el cliente conozca otro código. Para pedir ayuda humana, basta escribir «hablar con una persona». El asistente se identifica como virtual; no pretende ser una persona.

## Conectar WhatsApp Business real

Necesitas una instalación publicada con HTTPS, una cuenta de WhatsApp Business en Meta y un número habilitado para **WhatsApp Cloud API**. Usar solo la aplicación móvil de WhatsApp Business no activa esta API; revisa en Meta el proceso de incorporación o coexistencia disponible para tu número.

1. Publica la aplicación y crea tu cuenta propietaria. No uses la cuenta compartida de demo.
2. En tu aplicación de [Meta for Developers](https://developers.facebook.com/apps/), habilita WhatsApp y prepara un token de usuario del sistema con acceso al número y permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
3. En **Configuración → WhatsApp Business**, guarda el ID del número, el token de acceso y el secreto de la aplicación. Genera un código de verificación y cópialo antes de salir de la pantalla.
4. En Meta, configura la URL del webhook que muestra el panel y el mismo código de verificación. Suscribe el campo `messages` y comprueba la suscripción de la aplicación a tu cuenta de negocio.
5. Usa **Comprobar conexión**. Esto comprueba acceso al número; no demuestra por sí solo la recepción de webhooks.
6. Envía un mensaje desde un teléfono autorizado al número de negocio y comprueba recepción, respuesta y recibos en la bandeja. En cuentas de prueba, agrega antes el destinatario permitido en Meta.

Las credenciales se cifran con AES-256-GCM. El servidor valida cada webhook con `X-Hub-Signature-256`. Los eventos entrantes se deduplican por el ID de Meta y las respuestas se procesan mediante una cola persistente con hasta tres intentos. Una interrupción justo entre el envío confirmado por Meta y el guardado local puede causar una repetición saliente: la Cloud API no ofrece una clave de idempotencia para este envío. No se promete entrega exactamente una vez.

Esta versión atiende **texto**. Audio, imágenes y otros mensajes se registran como pendientes de atención humana; no se descargan ni interpretan. Las respuestas libres solo se envían dentro de las **24 horas** posteriores al mensaje del cliente. No incluye plantillas, campañas, pagos, recepción de medios, onboarding embebido de Meta ni sincronización con Shopify/WooCommerce.

## Publicar con alojamiento persistente

No se ha contratado alojamiento ni publicado un dominio. Se incluyen un `Dockerfile` y un blueprint `render.yaml` preparados para revisión.

### Render

1. Sube estos cambios a tu repositorio y crea un Blueprint de Render con `render.yaml`.
2. Revisa el plan y el disco persistente antes de contratar. El blueprint usa un servicio `starter` y 1 GB de disco; no depende de almacenamiento efímero gratuito.
3. El blueprint genera `APP_ENCRYPTION_KEY`, deshabilita la demo y cierra el registro tras la primera cuenta. El servidor detecta la URL HTTPS asignada mediante `RENDER_EXTERNAL_URL`. Para un dominio personalizado configura `APP_URL=https://tu-dominio`.
4. Abre el sitio y registra inmediatamente tu primera cuenta. La primera alta se permite con `REGISTRATION_OPEN=false`; las siguientes quedan cerradas. Para admitir más tiendas independientes, cambia explícitamente esa variable a `true`.
5. Agrega `OPENAI_API_KEY` como secreto si quieres IA generativa y conecta Meta desde tu cuenta. Conserva la clave de cifrado para poder restaurar las credenciales.

El blueprint no ejecuta una publicación desde este chat. Estos pasos requieren tu cuenta del alojamiento y la publicación del repositorio. No incluyas `.env` ni `data/` en Git.

### Otro servidor con Docker

```bash
docker build -t cerca .
docker run -d --name cerca --restart unless-stopped \
  -p 3000:3000 \
  -v cerca-data:/app/data \
  --env-file .env.production \
  cerca
```

Archivo `.env.production`, fuera del control de versiones:

```dotenv
NODE_ENV=production
APP_URL=https://tu-dominio
APP_ENCRYPTION_KEY=<secreto único de al menos 32 caracteres>
DEMO_MODE=false
REGISTRATION_OPEN=false
# Si hay exactamente un proxy inverso de confianza delante:
# TRUST_PROXY=1
# OPENAI_API_KEY=<opcional>
```

Genera el secreto con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdalo de forma segura. Coloca un proxy HTTPS delante del puerto 3000 y configura `TRUST_PROXY` según tu instalación. Configura **un solo proceso/instancia** para SQLite y el trabajador; esta versión no tiene una cola distribuida ni está preparada para escalado horizontal.

También puedes ejecutar `npm run build` y `NODE_ENV=production npm start` con las variables anteriores y una ruta persistente en `DATABASE_PATH`.

### Red y datos

- Instalación: HTTPS a `registry.npmjs.org`. Docker también necesita el registro oficial de imágenes de Node.
- Ejecución: `graph.facebook.com` para WhatsApp y, opcionalmente, `api.openai.com` para IA. Si el alojamiento limita la salida de red, habilita esos destinos conservando las reglas existentes.
- Entrada pública HTTPS a `/api/webhooks/whatsapp/:workspaceId`. No expongas la base ni las credenciales.
- La base por defecto está en `data/cerca.sqlite`. En desarrollo se genera una clave en `data/.encryption-key`, con permisos restrictivos. Producción exige `APP_ENCRYPTION_KEY` y HTTPS.
- Copias consistentes: `npm run backup -- /ruta/segura/cerca.sqlite`. Conserva por separado la clave de cifrado necesaria para restaurar las integraciones. El script no imprime datos de clientes ni credenciales.
- No hay envío de correo ni recuperación automática de contraseña. El panel maneja una cuenta propietaria por tienda; no incluye invitaciones ni roles de equipo.

## Validación

```bash
npm run build
npm test
npm run test:e2e
```

Las pruebas de API ejercitan cuentas y sesiones, aislamiento entre tiendas, catálogo, políticas, seguimiento autorizado, cifrado, firma y deduplicación de webhooks, cola de respuestas, ventana de atención y persistencia tras reinicio. Los proveedores externos se simulan: no se envían mensajes reales ni se consume una API de pago.

Las pruebas de navegador recorren demo, chat, respuesta manual, alta de cuenta, productos, pedidos, configuración, simulador y diseño móvil. Usan Chromium del sistema si está disponible; en otra máquina ejecuta `npx playwright install --with-deps chromium` o define `CHROMIUM_PATH`. Necesitan los puertos 3000 y 5173 libres y utilizan una base SQLite de prueba independiente. Las capturas se generan en `test-results/`.

También se comprueba la demo independiente con las solicitudes a la API bloqueadas, la persistencia al recargar, la importación CSV, la búsqueda, el modo oscuro y la exportación desde celular. Las pruebas del inicio verifican el salto del index local a la demo y que no haya un bucle de redirección.

## Generar el ZIP actualizado

```bash
npm ci
npm run package
```

La orden compila el servidor web y la demo independiente y escribe `descargas/Cerca-WhatsApp.zip`, junto con un manifiesto de tamaño y SHA-256. Incluye código, compilación, la demo, pruebas e instrucciones; omite `.env`, bases de datos, dependencias instaladas y enlaces simbólicos. Las capturas se incluyen si antes ejecutaste las pruebas de navegador. El `index.html` de la raíz del ZIP es la demo completa, no el punto de entrada de Vite.

Los cambios de la versión están en [CHANGELOG.md](CHANGELOG.md). El flujo `.github/workflows/ci.yml` valida compilación y pruebas en los siguientes cambios del repositorio.
