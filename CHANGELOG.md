# Cerca Restaurantes 5.0

- Buscador público por nombre, ciudad y tipo de atención; solo aparecen restaurantes publicados y activos.
- Dirección propia por restaurante en /r/nombre, metadatos para compartir y acceso público al menú y pedidos.
- Generador de página con preguntas sobre el negocio, especialidades, descripción y contactos.
- Editor con vista previa en computador/celular, colores propios, tres tipografías, tamaños de letra, distribución y orden de secciones.
- Borradores privados, revisión de cambios simultáneos y acciones independientes para guardar, publicar y retirar una página.
- Botones de WhatsApp y llamadas propios de cada negocio; acceso guiado para llamar desde WhatsApp.
- Avisos persistentes de pedidos en el panel y notificaciones opcionales del navegador mientras esté abierto; seguimiento del cliente con etapas y cambios de cocina.
- Acceso visible del dueño de la plataforma en /admin, guía de activación y enlaces a las páginas públicas desde Administración.
- Corrección del error administrativo sin sesión, privacidad de imágenes usadas en borradores, validación estricta de diseños y contraste automático.
- Sofía usa turnos seguros: micrófono pausado durante su voz, espera breve al finalizar y botón de interrupción. Interrupción por voz con auriculares opcional, filtro de ecos cortos y protección de eventos antiguos.
- Sofía consulta también la historia, descripción y especialidades publicadas del negocio.
- Identidad visual cálida para restaurantes con terracota, crema, figuras gastronómicas y componentes renovados; corrección de carga de fotos durante desarrollo.

# Cerca Restaurantes 4.0

- Plataforma para varios restaurantes con aislamiento de cuentas, menús, conversaciones, fotos, pedidos y reservas.
- Registro, ocho códigos de recuperación de un uso, recuperación opcional por correo con Resend y revocación de sesiones al restablecer la contraseña.
- Panel del dueño de la plataforma con activación privada, estadísticas, control del registro, suspensión de negocios, soporte por tickets e historial.
- Menú público con tres estilos, fotos optimizadas sin metadatos, búsqueda, ingredientes, alérgenos y QR descargable.
- Pedidos para mesa, recoger y domicilio con tarifas por zona, cálculo en servidor, existencias atómicas, reintentos sin duplicados y seguimiento privado.
- Pausa manual de la recepción de pedidos sin ocultar la carta ni las reservas.
- Cocina con estados, comandas imprimibles, verificación manual de pagos y restitución de existencias al cancelar una sola vez.
- Reservas con zona horaria, horarios, cierres, aforo, duración, confirmación del equipo y cancelación por enlace privado.
- Asesoría contextual, comparaciones, presupuesto, cantidades, documentos del negocio y búsqueda opcional con IA; hechos y totales controlados por el servidor.
- Interrupción de la voz, filtrado de eco, cancelación de consultas pendientes y protección frente a eventos de reproducción antiguos. Twilio usa Gather con bargeIn.
- Pruebas ampliadas de concurrencia, fotos, recuperación, permisos, pedidos, reservas e interrupciones; revisión axe/Lighthouse y copias que incluyen fotos.
- Se conserva la demo completa para doble clic y la migración de cuentas de versiones anteriores.

# Cerca 3.0

- Estudio del asistente con diseño nuevo, vista previa, voz, configuración y evaluación.
- Consola web con dictado y lectura en español, controles de micrófono/altavoz, transcripción, privacidad y alternativa por texto. Enlace público de voz opcional para clientes sin acceso al panel.
- Webhooks de WhatsApp Calling mediante Twilio, firma del SDK oficial, credenciales cifradas, deduplicación, manejo de silencios y derivación humana opcional. Requiere activar un remitente real y probarlo con el proveedor.
- Menú editable con tipo, precios, stock, ingredientes y alérgenos; CSV ampliado y migración de datos existentes.
- Respuestas escritas con datos guardados; clasificación opcional de consultas ambiguas con esquema JSON. Bloqueo de temas ajenos, ingredientes no confirmados y protección de pedidos en llamadas.
- Evaluación de respuestas, auditorías axe/Lighthouse, correcciones de contraste y etiquetas, pruebas de llamadas y acceso público. Informes incluidos en el ZIP.
- Carga por secciones en la versión con servidor; la demo portátil conserva un único HTML para doble clic.

# Cerca 2.0

- El `index.html` de la entrega abre una demo interactiva sin servidor. El proyecto y la compilación también incluyen `Cerca.html` como alternativa directa.
- Demo con persistencia en el navegador, importación y exportación, búsqueda, catálogo, pedidos, conversaciones, actividad y simulador. El modo de prueba se identifica en pantalla y no acepta credenciales reales.
- Diseño con textos más legibles, mejor contraste, tamaños de formulario adecuados para celular y modo oscuro persistente.
- Catálogo CSV con plantilla, revisión de filas, prevención de SKU duplicados e importación transaccional. Exportación del catálogo y filtro de stock.
- Búsqueda global con Ctrl+K o ⌘+K y acceso al producto, pedido o conversación seleccionado.
- Panel de sesiones con cierre de otros dispositivos, caducidad por inactividad y exportación de datos sin credenciales.
- Protección CSRF por sesión, cookies `__Host-` en producción, CSP con nonce, límites en los cambios de contraseña y permisos restrictivos para SQLite.
- Las contraseñas conservan sus espacios y la ventana del servidor ya no es necesaria para explorar la demo independiente.
- Nueva prueba del asistente limpia su contexto sin borrar el historial. Las métricas excluyen respuestas pendientes o fallidas.
- Pruebas ampliadas, validación automática en GitHub y generación reproducible de la entrega con `npm run package`.
