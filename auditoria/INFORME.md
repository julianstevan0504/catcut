# Cerca Restaurantes 4.0 · Revisión de funcionamiento, IA y sitio

Medición de accesibilidad: 2026-11-04T05:51:40.628Z. Se usaron cuentas y datos de prueba.

## Resultado

- **83/83 pruebas de API, datos, seguridad y asistente**, incluyendo aislamiento de negocios, capacidad y stock concurrentes, fotografías, recuperación, administración, soporte, pausa de cocina, cancelación de IA pendiente y migración de cuentas.
- **17/17 pruebas de navegador**. Después se repitieron **4/4 recorridos de restaurantes** con comprobación adicional de descarga del QR y del manejo de un error al cancelar una reserva.
- **33/33 casos en el analizador local de respuestas**, con precios, ingredientes, alérgenos, preguntas relacionadas, presupuesto, personas, contexto, variantes inexistentes, cálculos y privacidad. Los proveedores de IA se simulan; no es un análisis externo de un modelo real.
- **0 infracciones detectadas por axe en 42 vistas**: acceso, registro, recuperación, panel, cocina, reservas, galería, configuración de restaurante, soporte, administración y sus pestañas, asistente y guía, menú público, reserva y pedido, variantes móvil/oscura y tres estilos del menú.
- **0 errores de JavaScript** registrados y **ningún desbordamiento horizontal** en las vistas revisadas.
- **0 vulnerabilidades conocidas** reportadas por npm audit en las dependencias de producción de esta entrega.

| Lighthouse de escritorio · demo portátil servida localmente | Puntuación |
| --- | ---: |
| Rendimiento | 99 |
| Accesibilidad | 100 |
| Buenas prácticas | 100 |
| SEO | 100 |

Las cifras son una medición local y pueden variar con el dispositivo y alojamiento. La demo incluye todo el código en un HTML para abrirlo con doble clic; la versión con servidor carga pantallas por separado. Un resultado automático no certifica accesibilidad completa ni ausencia de vulnerabilidades.

## Correcciones y decisiones

Se corrigieron comparaciones que incluían productos por palabras genéricas, presupuestos expresados como «tenemos 50 mil», documentos recuperados fuera del atributo consultado y variantes inexistentes. El asesor usa documentos, contexto y datos actuales; la IA opcional puede buscar de nuevo pero no redacta hechos ni ejecuta operaciones libres.

Se añadieron registro y recuperación, panel privado del dueño, soporte con historial, menú con fotos y tres estilos, QR, cocina, pagos verificados manualmente, seguimiento privado, reservas con aforo y pausa de pedidos. Las fotos se decodifican y recodifican sin metadatos, tienen cuotas y una galería para borrar imágenes sin uso. Los detalles completos, fuentes OWASP y límites de escala están en [investigacion/DECISIONES.md](../investigacion/DECISIONES.md).

axe encontró textos con contraste insuficiente en cocina, guía y variantes oscuras, y un contador del carrito que faltaba en su nombre accesible. Se corrigieron los colores, la herencia del tema oscuro, la vista previa y el nombre accesible. La revisión final de 42 vistas no detectó infracciones. Las pruebas también verifican interrupciones de voz, rechazo del eco y eventos antiguos, recuperación con código, pedido público con foto, cocina y seguimiento, reserva desde celular y activación del administrador.

## Producción y entrega

Se comprobó el contenedor con demo desactivada, cookie Secure, primera cuenta propietaria, registro cerrado, sesión y datos conservados tras reiniciar, y copia de seguridad de SQLite con las fotos. El ZIP se verifica por hash SHA-256, integridad, exclusión de archivos privados, apertura del index sin API e instalación limpia del servidor empaquetado. La evidencia de entrega se adjunta como prueba-entrega.txt cuando finaliza la comprobación.

## Qué requiere activación real

No se hicieron llamadas telefónicas reales, pruebas de micrófono físico, envíos de correo reales ni consultas a un modelo con una clave externa. Se probaron voz simulada en navegador, webhooks firmados de Twilio/Meta y proveedores simulados. Para operar con clientes hacen falta alojamiento HTTPS, datos reales del restaurante y las cuentas de Meta, Twilio, OpenAI y Resend que se decidan usar. El correo es opcional: la recuperación con códigos ya funciona.

El dictado y la interrupción por voz dependen del navegador y del hardware. Las reservas públicas quedan pendientes de confirmación del equipo. Los pagos se verifican manualmente. El soporte es atendido por el dueño de la plataforma. La arquitectura usa una instancia de SQLite con disco persistente; el conteo de 102 restaurantes de prueba no representa una prueba de carga de 102 locales operando simultáneamente.

## Evidencias y repetición

- despues-axe.json, despues-lighthouse.json, ia-evaluacion.json y dependencias-produccion.json.
- pruebas-api.txt, pruebas-navegador.txt, pruebas-restaurantes.txt y prueba-produccion.txt.
- capturas/: pantallas revisadas del asistente, restaurante, cocina, reservas, soporte, administración y menús.
- Los archivos antes-*.json e ingreso-antes-axe.json son mediciones históricas conservadas de versiones anteriores.
- Comandos: npm run build, npm test, npm run test:e2e, npm run audit:assistant y npm run audit:site (Chromium necesario).
