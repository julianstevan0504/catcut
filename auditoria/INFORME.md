# Cerca 3.0 · Revisión del asistente y del sitio

Fecha de la revisión: 2026-11-04T00:33:50.953Z. Los datos y las cuentas usados son de prueba.

## Qué se encontró y qué se corrigió

| Hallazgo | Mejora aplicada |
| --- | --- |
| Textos con contraste insuficiente en navegación, tarjetas, formularios y acceso | Colores más legibles en los modos claro y oscuro; nueva revisión de las pantallas |
| El nombre accesible del buscador no coincidía con su etiqueta visible | Etiqueta nativa completa y texto accesible cuando se reduce a un icono |
| Una búsqueda aproximada podía mezclar «Alba» y «albahaca», o SKU con el mismo sufijo | Coincidencias por términos completos y prioridad al SKU exacto |
| Una respuesta libre de un modelo podía agregar datos sin respaldo | Respuestas finales escritas con datos guardados; IA opcional solo para clasificación con esquema cerrado |
| No había ingredientes ni alérgenos separados del texto descriptivo | Campos propios, tipo de ficha, edición, CSV, menú de productos disponibles y avisos por datos faltantes |
| No había una consola de llamadas ni un acceso para clientes | Consola de voz con controles, transcripción, enlace público opcional y límites por sesión |
| El proveedor de llamadas requería control de autenticidad y reintentos | Firma del SDK oficial, credenciales cifradas, control de cuenta/destino, turnos deduplicados y manejo de silencios |
| Era necesario distinguir una nota del equipo de una respuesta audible | Notas internas identificadas y excluidas de los mensajes enviados al cliente |
| La aplicación con servidor descargaba todas las pantallas al entrar | Carga por secciones para asistente, bandeja, productos y configuración |
| Cambiar directamente el fragmento de registro no actualizaba el formulario | Sincronización del modo de acceso con la dirección y la navegación del navegador |

## Analizadores de sitios

Se ejecutaron **axe-core 4.14.0** y **Lighthouse 13.6.0** localmente. Lighthouse midió la demo portátil, con el mismo perfil de escritorio antes y después. Las cifras pueden variar según equipo, carga y alojamiento.

| Lighthouse | Antes | Después |
| --- | ---: | ---: |
| Rendimiento | 100 | 99 |
| Accesibilidad | 95 | 100 |
| Buenas prácticas | 100 | 100 |
| SEO | 100 | 100 |

La revisión inicial del panel detectó 81 elementos con contraste insuficiente y un problema de etiqueta. La revisión ampliada de ingreso/registro también encontró contrastes insuficientes, que se corrigieron. En el resultado final de axe hay **0 elementos con infracciones detectadas** en **16 vistas revisadas**, incluidas las variantes móvil y oscura, ingreso, registro y llamada pública. No se detectaron errores de JavaScript ni desbordamiento horizontal en la vista móvil probada.

Lighthouse sigue señalando código o estilos que no se usan en la primera pantalla del HTML portátil. Ese archivo contiene toda la demo para abrirla con doble clic; las otras secciones usan esos recursos. En la aplicación con servidor se dividió la carga por secciones. La auditoría automática no certifica conformidad total de accesibilidad ni seguridad.

## Analizador de respuestas

El evaluador local superó **27/27 casos** con expectativas explícitas: menú con precios e ingredientes, agotados, productos y variantes inexistentes, ingredientes desconocidos, alérgenos, contexto, cambios de stock, seguimiento autorizado, privacidad en llamadas, temas ajenos, manipulación de instrucciones y salidas de un proveedor simulado.

No se utilizó un evaluador de IA externo ni una clave real de OpenAI. La clasificación con IA se probó con respuestas simuladas válidas y hostiles. El panel incluye una evaluación que puedes repetir con los datos de tu tienda y descargar en JSON.

## Verificación de funcionamiento y seguridad

- **59 pruebas de API, datos y seguridad superadas**, incluidos webhooks firmados, reintentos, silencios, transferencia opcional, aislamiento de tiendas, notas privadas, exportación sin tokens, sesiones, CSRF y migración de productos anteriores.
- **12 pruebas de navegador superadas**, incluido catálogo editable, dictado/lectura simulados, fin de llamada, permiso de micrófono rechazado, acceso público sin entrar al panel y demo sin API.
- **0 vulnerabilidades conocidas** reportadas por npm audit en las dependencias de producción. Esto no garantiza ausencia de fallos desconocidos.
- Contenedor de producción: inicio, cuenta propietaria, cookie Secure, demo desactivada, cierre del registro, reinicio con datos conservados y copia de seguridad comprobados.
- El ZIP se comprueba por SHA-256, integridad de archivos, apertura de su index sin API e instalación limpia del servidor empaquetado.

## Lo que debes configurar con tu negocio

1. Carga tu menú real, precios, stock, ingredientes y alérgenos. Los ejemplos de la demo no representan tu negocio.
2. Publica el servidor con HTTPS para clientes externos y webhooks. Activa el enlace de voz solo cuando quieras compartirlo.
3. Para mensajes de WhatsApp, configura Meta. Para llamadas, habilita un remitente de WhatsApp Business Calling en Twilio y configura los webhooks y credenciales cifradas; revisa compatibilidad/migración de un número existente y tarifas con el proveedor.
4. Prueba una llamada real en tu teléfono y en los navegadores de tus clientes. Esta entrega verifica voz de navegador simulada y webhooks firmados; no se realizó una llamada real ni se midió calidad de audio con hardware.
5. Mantén actualizados el catálogo, los horarios y las copias de seguridad. Valida alérgenos con el equipo; el asistente no garantiza seguridad alimentaria.

## Evidencias

- antes-axe.json y antes-lighthouse.json: medición inicial del panel.
- ingreso-antes-axe.json: hallazgos previos de ingreso y registro.
- despues-axe.json y despues-lighthouse.json: mediciones finales.
- ia-evaluacion.json: casos y resultados del asistente.
- dependencias-produccion.json: npm audit de producción.
- pruebas-api.txt, pruebas-navegador.txt y prueba-produccion.txt: resultados de las verificaciones.
- capturas/: diseño del asistente, consola de voz, evaluación, celular y modo oscuro.

SHA-256 del HTML portátil revisado: `1285bb0ed817367a78647ffddb8969eea0d5ef73a8697ff5b307015080c7448e`.
