# Cerca Restaurantes 4.0

**[Descargar la plataforma completa en ZIP](https://github.com/julianstevan0504/catcut/raw/refs/heads/entrega-cerca-whatsapp/descargas/Cerca-WhatsApp.zip)**

Plataforma en español para varios restaurantes: cada negocio tiene su cuenta, menú con fotos, pedidos, reservas, conversaciones, asistente y registro de actividad. Incluye un panel independiente para el dueño de la plataforma y soporte por solicitudes. React + TypeScript + Express + SQLite. Node.js **24 o superior**.

## Abrir y probar

Descomprime todo el ZIP y abre **index.html** de la carpeta principal con doble clic. Es una demo completa en un solo HTML: permite explorar cocina, reservas, fotos, los tres estilos del menú, asistente, voz y administración. No necesita Node.js ni conexión a una API. También puedes abrir **Cerca.html**. Las pruebas se guardan en este navegador si su almacenamiento lo permite; es una demostración, no un negocio real, y no acepta credenciales de proveedores.

Para cuentas reales, usa **INICIAR_WINDOWS.bat**, **INICIAR_MAC.command** o **INICIAR_LINUX.sh**. Instala antes Node.js 24; el iniciador descarga dependencias desde npm la primera vez, comprueba el servidor y abre el navegador. También puedes ejecutar `node scripts/start-local.mjs` dentro de `proyecto/`. Mantén abierta su ventana. Este iniciador escucha solo en localhost; para atender clientes externos debes publicar el servidor con HTTPS.

El `index.html` del código de desarrollo redirige a `Cerca.html` al abrirlo como archivo local. El de la raíz del ZIP ya contiene toda la demo. Con servidor, se carga la aplicación por secciones.

Para desarrollar:

```bash
npm ci
cp .env.example .env
npm run dev
```

Cliente: http://localhost:5173. API: puerto 3000. **Explorar la demo** abre La Mesa, un restaurante ficticio compartido. **Crear tu cuenta** crea un restaurante vacío y aislado. Los datos de la demo del navegador y del servidor son independientes. Una actualización conserva las cuentas, productos y sesiones anteriores.

## Preparar un restaurante

1. Regístrate y **descarga los ocho códigos de recuperación** que se muestran una sola vez. Guárdalos en un lugar privado.
2. En **Mi restaurante**, configura identidad, enlace único, foto de portada, logo y estilo Tierra, Jade o Ciruela. En **Gestionar fotos y espacio** puedes borrar imágenes sin uso; las que usa el menú están protegidas.
3. En **Menú y fotos**, carga platos, bebidas, precios COP, existencias, ingredientes confirmados y alérgenos. Cada foto se optimiza; nunca se deducen ingredientes de una imagen. Puedes importar hasta 500 filas por CSV con revisión previa y actualización explícita de SKU.
4. En **Atención y pedidos**, habilita mesa, recogida o domicilio y sus zonas/tarifas. Define pedido mínimo y tiempo estimado de preparación. Puedes pausar manualmente la recepción de pedidos al cerrar o si la cocina está saturada; el menú y las reservas siguen disponibles.
5. En **Horarios y reservas**, configura zona horaria IANA, franjas por día, aforo, tamaño de grupo, duración y fechas de cierre. Guardar el restaurante actualiza también horarios y servicios del asistente.
6. Publica el menú y comparte el enlace o descarga su QR. La publicación empieza desactivada en cuentas reales. Las fotos son privadas mientras el menú está sin publicar.
7. En **Asistente IA → Configurar → Guía del negocio**, escribe detalles del local, accesibilidad, terraza, mascotas, preparación y políticas, o importa textos .txt/.md. Hasta 60 documentos, 12.000 caracteres por documento y 180.000 en total. Carga solo información que puedas compartir con clientes.

El menú público muestra ingredientes, alérgenos, horarios, existencias y el total antes de confirmar. No ofrece modificaciones ni productos inexistentes como si estuvieran disponibles. Confirma con cocina los alérgenos y posibles trazas; la aplicación no garantiza seguridad alimentaria.

## Pedidos, cocina y reservas

El cliente elige mesa, recogida o domicilio y confirma productos, cantidades y total. **El servidor calcula el precio**, aplica la tarifa de zona y descuenta existencias en una transacción. Si cambian precios o stock, se exige revisar el pedido. Reintentar la misma solicitud no crea otro pedido.

En **Cocina**, los pedidos pasan por recibido, preparando, listo, enviado si corresponde y entregado. Se pueden imprimir comandas y marcar un pago como verificado por el equipo. Cancelar restituye existencias una sola vez. **No se cobran tarjetas ni se verifican transferencias bancarias automáticamente.** El historial anterior sigue disponible en **Historial de pedidos**; esos registros manuales no descuentan stock ni pueden saltarse los estados de un pedido de cocina.

Las reservas consideran la superposición real de visitas y el aforo. El cliente elige entre horarios disponibles y confirma sus datos; la solicitud queda pendiente de confirmación del restaurante y ocupa capacidad. El panel permite confirmar, recibir, completar, cancelar o marcar ausencia. El cliente puede consultar y cancelar desde un enlace privado aleatorio. No se publican listas de clientes ni se permite buscar reservas por un teléfono adivinado.

El enlace de seguimiento de un pedido o reserva es privado: quien lo tenga puede consultar ese registro. Compártelo solo con la persona correspondiente. Conserva avisos de privacidad y una política de tratamiento de datos adecuados a tu operación.

## Dueño de la plataforma y soporte

El registro de un negocio **no lo convierte en administrador**. La activación del dueño requiere su sesión, su contraseña y la clave privada de instalación `PLATFORM_SETUP_TOKEN` (32 caracteres aleatorios como mínimo). Solo se permite una activación inicial.

Con el iniciador local, la clave se crea en **proyecto/data/administracion-clave.txt**. Ábrela tú mismo y pégala en **Configuración → Datos y seguridad → Activar administración de la plataforma**, junto con tu contraseña. No la compartas ni subas `data/` a GitHub. En Render, usa el secreto generado en las variables de entorno del servicio.

La sección **Administración** muestra negocios registrados y activos, cuentas propietarias, totales de pedidos y reservas, solicitudes de soporte e historial administrativo. Puedes abrir/cerrar el registro y suspender o reactivar un restaurante con un motivo. El panel no incluye las conversaciones privadas de otros negocios. Un restaurante suspendido conserva acceso a recuperación y soporte; sus canales públicos se detienen.

Cada restaurante crea y sigue solicitudes en **Soporte técnico**. El administrador responde desde su panel y actualiza su estado. Es un sistema de tickets atendido por quien opera la plataforma; no implica personal externo contratado ni atención humana 24/7.

## Recuperación y seguridad

En el acceso, **Olvidé mi contraseña** permite recuperar con correo y un código de un solo uso. Renovar códigos en Datos y seguridad requiere la contraseña actual e invalida los anteriores. Restablecer la contraseña revoca todas las sesiones.

Para recuperación por correo, configura `RESEND_API_KEY` y `EMAIL_FROM` con un remitente verificado en Resend. El enlace dura 30 minutos y solo sirve una vez. La respuesta pública no revela si existe una cuenta ni devuelve el enlace. Sin proveedor configurado, la interfaz ofrece los códigos. El envío se probó con un proveedor simulado.

Contraseñas scrypt; sesiones aleatorias guardadas como hashes; cookies `HttpOnly`, `SameSite=Lax`, `__Host-` y `Secure` en producción; caducidad a siete días o 24 horas sin actividad; CSRF por sesión; CSP con nonce por respuesta; integraciones cifradas AES-256-GCM. La cuenta del negocio procede de la sesión, nunca de un identificador elegido en el navegador. El administrador también necesita autorización del servidor.

Fotos: JPG/PNG/WebP decodificados y recodificados con Sharp, tamaño/píxeles limitados, eliminación de metadatos, nombres aleatorios y almacenamiento fuera de los archivos públicos. Hasta 200 fotos y 50 MB por restaurante, dos conversiones simultáneas como máximo. No se aceptan SVG ni URLs externas. También se limitan intentos de acceso, recuperación, cargas y acciones públicas. Los CSV exportados neutralizan fórmulas.

## Asesoría con contexto e IA opcional

El asistente relaciona productos, documentos y preguntas anteriores: compara platos, recomienda según presupuesto y personas, calcula cantidades, sugiere bebidas y responde varias consultas de la operación. Puedes borrar el contexto o desactivar el recuerdo de preferencias. Los detalles ausentes se reconocen como faltantes; se puede solicitar atención humana.

Sin claves hay un motor local en español. Con `OPENAI_API_KEY` y `OPENAI_MODEL` (por defecto `gpt-4.1-mini`), la Responses API genera un plan cerrado y puede buscar de nuevo en el catálogo y la guía del negocio. Se permiten hasta tres rondas de búsqueda y se valida cada identificador. **El servidor redacta con hechos guardados y calcula los totales.** El modelo no tiene acceso a pedidos privados, credenciales ni a Internet; no ejecuta operaciones libremente. Se envían la consulta, contexto comercial y fragmentos relevantes, con redacción de teléfonos, correos y códigos. Se usa `store:false`.

Para pedidos y reservas conversacionales se prepara un resumen y se pide **«confirmar pedido»** o **«confirmar reserva»**. Solo entonces el servidor valida existencias o capacidad y registra la operación. Los borradores caducan a los 30 minutos. Las preguntas relacionadas no descartan automáticamente un borrador. Una respuesta inválida o un fallo del proveedor usa las fuentes locales y deja constancia.

El seguimiento por WhatsApp solo devuelve pedidos del número remitente. En llamadas no se revelan pedidos anteriores; se pide continuar desde el número de compra por WhatsApp. El asistente se presenta como virtual. El proveedor de IA se verificó con respuestas simuladas válidas y hostiles; hace falta probar el modelo real al configurar la clave.

## Hablar y escuchar desde la web

Abre **Asistente IA → Voz y llamadas**. Puedes iniciar, hablar para interrumpir la reproducción, pulsar «Interrumpir y hablar», silenciar micrófono/altavoz, escribir y terminar. Se filtra el eco y se cancelan consultas de IA pendientes al interrumpir o colgar. El resultado de la interrupción por voz depende del navegador y del micrófono. La transcripción se guarda en **Conversaciones** y en el historial de llamadas. Desde la bandeja puedes añadir notas internas para tu equipo; no se reproducen al cliente. No se graban archivos de audio. Al salir de la pantalla se detienen el dictado y la reproducción.

El dictado usa `SpeechRecognition` del navegador; la voz usa `speechSynthesis`. La compatibilidad depende del navegador, idioma, permisos y sistema. Prueba Chrome o Edge en **HTTPS o localhost**. Si el dictado no está disponible o no tiene permiso, puedes seguir por texto. La demo con doble clic puede no tener acceso al micrófono: para probarlo usa el iniciador local. El reconocimiento puede procesar audio mediante el servicio del navegador, que tiene sus propias condiciones. El aviso se muestra antes de iniciar.

Desde tu cuenta con servidor puedes activar **Enlace público de voz** y compartir la dirección real que aparece en pantalla. El cliente solo ve el asistente: no necesita cuenta y no ve el panel ni datos privados. El enlace empieza desactivado. Cada llamada tiene un token aleatorio, dura como máximo 30 minutos y permite hasta 40 consultas, con límites de solicitudes. Desactivar el enlace revoca las llamadas públicas activas. Los tokens no se incluyen en las exportaciones.

## Llamadas entrantes de WhatsApp con Twilio

La integración implementa webhooks de Twilio Programmable Voice y TwiML con reconocimiento `es-CO` y voz española. Es **una conexión diferente** de los mensajes de Meta Cloud API.

1. Publica el servidor con HTTPS y `APP_URL` igual a su dirección pública exacta.
2. Habilita **WhatsApp Business Calling** para tu remitente con Twilio. Su disponibilidad, aprobación y tarifas dependen del proveedor. Si ya usas el número con Meta, revisa con Twilio su compatibilidad o migración antes de cambiar nada.
3. En **Voz y llamadas**, guarda Account SID, Auth Token y número del remitente. El token se cifra con AES-GCM y no se devuelve al navegador. Usa tu cuenta real; las demos no aceptan credenciales.
4. Copia las direcciones de llamada entrante y estado al remitente/canal de voz del proveedor, ambas con **POST**. Configura allí los eventos de finalización.
5. Prueba una llamada real. La pantalla distingue **configuración guardada** de **webhook firmado recibido**; recibir un webhook no certifica por sí solo toda la calidad de audio.

Se verifica la firma con el SDK oficial y la URL pública, Account SID y número de destino; se rechazan llamadas de otro canal. Los turnos se deduplican, Gather habilita `bargeIn` y tres silencios consecutivos terminan la llamada. Puedes marcar cero o pedir una persona. Si configuras un número del equipo, se intenta una transferencia de voz a ese número; puede implicar tarifas adicionales y depende de su disponibilidad. Si no hay destino, la solicitud queda pendiente y se informa al cliente. No se realizan llamadas salientes automáticas ni se activa el servicio desde este repositorio.

No se ha validado una llamada real en esta entrega porque no se proporcionaron credenciales ni un remitente habilitado. Se probaron webhooks firmados, TwiML, reintentos, silencios, privacidad y flujo de navegador con voz simulada. Referencia: [WhatsApp Business Calling de Twilio](https://www.twilio.com/docs/voice/whatsapp-business-calling).

## Evaluación del asistente y del sitio

En **Asistente IA → Evaluar**, comprueba las reglas con los datos de tu tienda y descarga el resultado en JSON. Esta prueba local no equivale a una certificación ni a una evaluación externa de un modelo.

```bash
npm run audit:assistant  # Casos de alcance, precios, ingredientes, privacidad y entradas hostiles
npm run audit:site       # axe-core + Lighthouse; requiere Chromium (CHROMIUM_PATH opcional)
```

Consulta `investigacion/DECISIONES.md`, `auditoria/INFORME.md`, los JSON y las capturas para ver hallazgos, correcciones y límites de la revisión. La medición Lighthouse usa la demo portátil servida localmente; los números pueden variar según el equipo y el alojamiento.

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
3. El blueprint genera `APP_ENCRYPTION_KEY` y `PLATFORM_SETUP_TOKEN`, deshabilita la demo y empieza con registro cerrado tras la primera cuenta. El servidor detecta la URL HTTPS asignada mediante `RENDER_EXTERNAL_URL`. Para un dominio personalizado configura `APP_URL=https://tu-dominio`.
4. Abre el sitio y registra inmediatamente tu primera cuenta. La primera alta se permite con `REGISTRATION_OPEN=false`; las siguientes quedan cerradas. Activa tu administración con la clave privada y abre el registro desde su panel para admitir más restaurantes.
5. Agrega `OPENAI_API_KEY` como secreto si quieres asesoría con IA y conecta Meta desde tu cuenta. Conserva la clave de cifrado para poder restaurar las credenciales.

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
# PLATFORM_SETUP_TOKEN=<otro secreto aleatorio privado, mínimo 32 caracteres>
# OPENAI_API_KEY=<opcional>
# RESEND_API_KEY=<opcional>
# EMAIL_FROM=<remitente verificado opcional>
```

Genera el secreto con `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` y guárdalo de forma segura. Coloca un proxy HTTPS delante del puerto 3000 y configura `TRUST_PROXY` según tu instalación. Configura **un solo proceso/instancia** para SQLite y el trabajador; esta versión no tiene una cola distribuida ni está preparada para escalado horizontal.

También puedes ejecutar `npm run build` y `NODE_ENV=production npm start` con las variables anteriores y una ruta persistente en `DATABASE_PATH`.

### Red y datos

- Instalación: HTTPS a `registry.npmjs.org`. Docker también necesita el registro oficial de imágenes de Node.
- Ejecución: `graph.facebook.com` para WhatsApp y, opcionalmente, `api.openai.com` para asesoría con IA; `api.resend.com` si activas el correo de recuperación. Los webhooks de Twilio requieren acceso HTTPS entrante; el servidor devuelve TwiML y no envía audio a OpenAI. Si el alojamiento limita la salida de red, habilita esos destinos conservando las reglas existentes.
- Entrada pública HTTPS a `/api/webhooks/whatsapp/:workspaceId`. No expongas la base ni las credenciales.
- La base por defecto está en `data/cerca.sqlite`. En desarrollo se genera una clave en `data/.encryption-key`, con permisos restrictivos. Producción exige `APP_ENCRYPTION_KEY` y HTTPS.
- Copias consistentes: `npm run backup -- /ruta/segura/cerca.sqlite`. El script copia SQLite y sus fotos a `cerca.sqlite.media/`. Conserva por separado `APP_ENCRYPTION_KEY` y las claves de instalación. Para restaurar, detén el servicio, restaura la base y copia esa carpeta a `media/` junto a la base, con permisos del usuario del servidor. Verifica el resultado antes de reabrir el servicio. El script no imprime datos de clientes ni credenciales.
- El disco persistente contiene la base y las fotos. Dimensiona el almacenamiento para el conjunto de negocios, vigila su uso y mantén copias externas. Los 50 MB son un límite por restaurante, no una reserva de espacio.
- Cada restaurante tiene una cuenta propietaria; no se incluyen invitaciones ni roles de camarero/cocina por usuario. Para escalar a varias instancias deben migrarse SQLite, archivos y cola a servicios compartidos; revisa investigacion/DECISIONES.md.

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
