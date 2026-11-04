# Revisión de producto y seguridad · Cerca Restaurantes 4.0

Revisión de noviembre de 2026. Se consultaron guías oficiales de OWASP sobre autorización, aplicaciones con múltiples negocios, recuperación de contraseñas y carga de archivos. Se contrastaron con el código y los recorridos de un restaurante. Las comprobaciones externas de llamadas, correo e IA requieren las cuentas del operador; las pruebas incluidas simulan esos proveedores.

## Lo que necesita quien atiende el restaurante

| Problema de la operación | Decisión implementada |
| --- | --- |
| Recibir mensajes mientras se atiende una mesa | Bandeja con historial, respuesta manual, pausa del asistente, notas internas y derivación a una persona. |
| Cada restaurante tiene carta, clientes y condiciones distintos | Cuenta y datos separados; el servidor obtiene el negocio de la sesión. El panel global no muestra chats privados de otros restaurantes. |
| El menú debe invitar a comprar y ser fácil de mantener | Tres estilos, fotos de platos, portada, logo, categorías, búsqueda, ingredientes y alérgenos. Importación CSV con revisión; QR descargable en servidor. |
| Aceptar un pedido sin conocer el precio final genera conflictos | Total calculado en servidor, domicilio por zona, cantidades, resumen y confirmación; si cambia el precio se requiere revisarlo. |
| Dos clientes compran el último plato | Descuento de existencias en transacción y deduplicación por solicitud. Cancelar repone una sola vez. |
| La cocina se satura o ya cerró | Pausa manual de pedidos del menú y del asistente; se conserva el menú y la recepción de reservas. No se promete una pausa automática por horario. |
| Un pedido se pierde entre mensajes | Cola de cocina recibido → preparando → listo → entregado, domicilio cuando corresponde, comanda imprimible y seguimiento privado. |
| Una transferencia todavía no llegó | Pago pendiente hasta verificación manual del equipo. No se solicitan tarjetas ni contraseñas bancarias. |
| Las reservas se superponen | Aforo con superposición de visitas, horarios, cierres, duración y zona horaria. La solicitud pendiente ocupa capacidad; el equipo la confirma. |
| Un cliente necesita modificar su asistencia | Enlace privado para ver y cancelar su reserva; estados de recibido, completado o ausencia en el panel. |
| Se olvida la contraseña | Ocho códigos de recuperación de un uso; enlace por correo opcional con vencimiento, consumo único y revocación de sesiones. |
| Hay varios negocios y necesitan ayuda | Panel del dueño con conteos, búsqueda, apertura/cierre de altas, suspensión motivada, solicitudes de soporte y registro administrativo. |
| El cliente no formula la pregunta exactamente como una FAQ | Documentos del negocio, sinónimos, contexto, comparación, presupuesto, personas y cantidades. La IA opcional puede volver a buscar en las fuentes. |
| El asistente habla demasiado o entendió otra cosa | Interrupción por voz o botón, filtrado de eco, cancelación de consulta pendiente y protección contra eventos antiguos de reproducción. |
| Una pregunta toca alergias o un detalle que no consta | Datos registrados y aviso de verificación humana; no se inventan ingredientes, modificaciones, calorías ni garantías de seguridad. |
| Cambiar de versión no debe borrar el negocio | Migraciones de SQLite y prueba de conservación de cuenta y sesión. Copia de base más fotos; demo separada de producción. |

## Revisión como desarrollador

**Aislamiento y permisos.** Los recursos privados se consultan con el identificador del restaurante autorizado en la sesión. Enviar un `workspace_id`, correo ajeno o rol desde el navegador no concede acceso. Administración requiere una activación inicial con clave privada de instalación y contraseña; no se asigna al primer usuario por defecto. Suspender un negocio detiene sus accesos operativos y canales públicos, manteniendo soporte y recuperación.

**Recuperación.** Códigos aleatorios de 128 bits guardados como hashes. Enlaces con token aleatorio, hash, vencimiento de 30 minutos y consumo transaccional. Respuesta genérica con independencia de la existencia de la cuenta, límites de solicitudes y revocación de sesiones al cambiar la contraseña. El enlace nunca aparece en la respuesta pública de la API. Renovar los códigos requiere la contraseña y anula los anteriores. El correo necesita Resend y un remitente verificado.

**Fotos.** No basta comprobar la extensión: el servidor decodifica JPG/PNG/WebP con Sharp, limita bytes y píxeles y recodifica a WebP sin metadatos. Los nombres son aleatorios, sin rutas elegidas por el usuario, y se guardan fuera de `dist`. Se verifican los permisos al adjuntar una foto a un plato o portada. Una imagen en borrador exige sesión del negocio; al publicar el menú pasa a ser visible. Máximo 200 fotos y 50 MB por negocio, dos conversiones simultáneas y una carga por negocio en proceso. La galería permite borrar imágenes sin uso y protege las utilizadas. El disco global necesita dimensionamiento y vigilancia por el operador.

**Integridad de operaciones.** Precios, tarifas, existencias y aforo se leen del servidor; no se aceptan totales como autoridad. Se deduplican solicitudes y se controlan las transiciones de estado. Los enlaces de seguimiento usan tokens privados aleatorios, no un código corto adivinable. No se ofrecen buscadores públicos por teléfono. La consulta de pedidos por WhatsApp se limita al número remitente; una llamada no autentica compras anteriores.

**IA con fuentes.** El proveedor opcional produce un plan estructurado. Solo puede usar productos y fuentes que se le hayan mostrado; las cantidades se contrastan con la consulta, los hechos se vuelven a leer y el servidor compone la respuesta. Se rechazan identificadores y salidas inventados. Las fuentes y mensajes se tratan como datos y se limita la búsqueda a tres rondas. El modelo no accede a credenciales, pedidos privados ni Internet. Las operaciones conversacionales requieren un resumen y confirmación explícita y vuelven a verificar disponibilidad.

**Superficie web y sesiones.** Contraseñas scrypt, sesiones opacas con hash, cookies seguras de producción, CSRF por sesión y CSP con nonce. Límites en acceso, recuperación y cargas. Exportaciones sin credenciales ni tokens privados; CSV protegido contra fórmulas. Los errores de los proveedores tienen respaldo local. Las notas del equipo no se reproducen al cliente. Las comprobaciones automáticas no sustituyen una prueba de penetración independiente.

## Hallazgos corregidos durante esta entrega

- La recomendación no entendía «tenemos 50 mil»: se amplió el reconocimiento del presupuesto y se verifican presupuesto y número de personas.
- Un término genérico como «Casa» podía agregar platos a una comparación: tienen prioridad los nombres completos y los SKU exactos.
- Una variante inexistente podía terminar mostrando una guía de otro tema: se conserva la respuesta de no disponibilidad para esa petición.
- Una consulta nutricional podía recuperar instrucciones de recalentado: se exige coincidencia con el atributo solicitado y se informa el dato ausente.
- Una reproducción antigua podía interferir con una nueva intervención: se identifican generaciones de voz, se ignoran eventos antiguos y se cancela la consulta pendiente.
- Las fotos reemplazadas podían consumir el cupo sin una forma de borrarlas: se añadió galería con permisos y protección de imágenes en uso.
- El horario del asistente podía diferir del de reservas: guardar el restaurante actualiza horarios, servicios y zona horaria del asistente.
- La navegación completa necesitaba poder desplazarse en pantallas pequeñas: se ajustó el espacio de la barra lateral y su desplazamiento.
- axe encontró contrastes insuficientes y un contador visual que no coincidía con el nombre accesible: se corrigieron colores, el tema oscuro y la etiqueta accesible del carrito. Los resultados finales se guardan en auditoria/INFORME.md.

## Configuración que corresponde al operador

1. Alojamiento HTTPS, disco persistente, copias externas y claves privadas. El repositorio incluye Docker y Render; el ZIP no compra ni publica alojamiento.
2. Cuenta Meta y número habilitado para mensajes de WhatsApp Cloud API. Las llamadas entrantes usan Twilio WhatsApp Business Calling, que requiere disponibilidad y activación del proveedor. Revisar compatibilidad del número y tarifas.
3. Clave OpenAI para la asesoría semántica opcional y Resend para recuperación por correo. Sin esas claves funcionan el motor local y los códigos de recuperación.
4. Personal que responda al soporte y a las derivaciones, menú real, existencias, ingredientes/alérgenos, datos del local y política de privacidad.
5. Probar una llamada real, el modelo configurado y el envío de correo antes de ofrecerlos a clientes. El dictado de navegador puede usar servicios del fabricante y depende de equipo, permisos y navegador.

## Capacidad y evolución

Esta versión admite múltiples negocios en **una instancia** con SQLite y almacenamiento persistente. La prueba de administración verifica el conteo de 102 restaurantes; no equivale a una prueba de carga de 102 negocios atendiendo al mismo tiempo. Los límites por cuenta no reservan almacenamiento físico. Para mayor tráfico se necesitarán mediciones reales de carga, PostgreSQL, archivos en un servicio de objetos y cola compartida antes de habilitar varias instancias.

Se priorizaron la operación de restaurante y el aislamiento de cuentas. Facturación electrónica, cobros automáticos, campañas de WhatsApp, invitaciones y permisos individuales de camarero/cocina requieren flujos y proveedores propios. No se muestran como funciones activadas. El registro público está bajo control del dueño; en entornos con abuso conviene añadir verificación de contacto antes de ampliar el volumen de reservas.

## Fuentes consultadas

- [OWASP Multi-Tenant Security Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.md): contexto del negocio, permisos por recurso y prevención de filtraciones entre cuentas.
- [OWASP Authorization Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Authorization_Cheat_Sheet.md): autorización en cada petición, privilegios mínimos y rechazo del acceso ajeno.
- [OWASP Forgot Password Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Forgot_Password_Cheat_Sheet.md): mensajes genéricos, tokens de un uso, vencimiento y protección contra abuso.
- [OWASP File Upload Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/File_Upload_Cheat_Sheet.md): comprobación real del contenido, nombres generados, límites y almacenamiento fuera del directorio público.
- [Twilio WhatsApp Business Calling](https://www.twilio.com/docs/voice/whatsapp-business-calling): referencia de activación del proveedor; no se realizó una llamada externa real.

Las cuatro guías OWASP se descargaron desde su repositorio oficial y se leyeron durante la revisión. Las decisiones de producto se contrastaron con los flujos de esta implementación; no se presentan como un estudio estadístico de restaurantes ni como una certificación externa.
