# Cerca Restaurantes 5.1 · Revisión de errores, diseño y seguridad

Fecha: 2026-11-04, 17:45 (Colombia, America/Bogota). Se usaron cuentas y datos de prueba. La auditoría automática se complementó con revisión de código, recorridos de cliente/dueño y capturas de computador y celular.

## Resultado

- **90/90 pruebas de API, datos, seguridad y asistente**, incluidos aislamiento entre negocios, stock y capacidad concurrentes, recuperación, fotos privadas, publicación y webhooks firmados.
- **29/29 recorridos de navegador**. Incluyen siete regresiones nuevas de red lenta, reservas, resumen, teclado móvil, notificaciones, stock, tildes, filtros compartidos y enlaces de regreso.
- **33/33 casos de respuestas** en el analizador local del asistente: contexto, preguntas relacionadas, presupuestos, precios, ingredientes, alérgenos, existencias y privacidad.
- **0 infracciones de axe en 59 vistas**, con panel claro/oscuro/celular, menú móvil, editor, administración, cocina, reservas, asistente, menú y pedido públicos y colores personalizados intermedios.
- **0 errores de JavaScript y ningún desbordamiento horizontal** en las vistas de la auditoría.
- **0 vulnerabilidades conocidas en npm audit completo**, incluidas dependencias de desarrollo, y también 0 en producción.

| Lighthouse de escritorio · demo portátil servida localmente | Puntuación |
| --- | ---: |
| Rendimiento | 98 |
| Accesibilidad | 100 |
| Buenas prácticas | 100 |
| SEO | 100 |

Lighthouse 13.5.0. Son mediciones locales, que varían con el equipo y alojamiento; no certifican ausencia de errores o accesibilidad completa. La demo reúne el código en un HTML para abrirlo con doble clic; la versión con servidor carga pantallas por secciones.

## Errores encontrados y corregidos

| Área | Problema y corrección |
| --- | --- |
| Consultas periódicas | Un intervalo podía iniciar otra consulta antes de terminar la anterior y permitir respuestas desordenadas. Ahora se programa la siguiente tras completar o fallar la actual; al abandonar una vista se cancela la consulta. La prueba mantiene una petición bloqueada y comprueba que no se solape. |
| Disponibilidad de reservas | Un fallo de conexión parecía un día sin horarios. Se muestra el error con reintento y no se confirma con disponibilidad fallida. El grupo inicial respeta un máximo de una persona y el calendario limita la anticipación configurada. |
| Avisos antiguos | Leer los primeros 30 avisos podía traer uno anterior y anunciarlo como nuevo. Se conserva la referencia temporal y los identificadores observados para distinguirlos. |
| Notificaciones del dispositivo | Algunos navegadores permiten solicitar permiso pero rechazan el constructor Notification. Se captura el error, se conservan los avisos dentro de Cerca y se puede desactivar la preferencia del dispositivo. |
| Resumen del dueño | Una carga fallida podía mostrar ceros como si fueran datos reales. Ahora informa del fallo y ofrece reintento. |
| Menú móvil | El menú oculto seguía en el recorrido del teclado. Se excluye con inert; al abrirlo se contiene el foco, se bloquea el fondo y Escape lo cierra. Ayuda, navegación y cierre de sesión liberan el foco y el desplazamiento. |
| Carrito y búsqueda | Tras actualizar existencias podían quedar cantidades antiguas. El carrito se ajusta y avisa antes de reintentar; una prueba reduce el stock mientras el cliente prepara su compra y confirma después el pedido corregido. Buscar cafe encuentra Café. |
| Filtros del buscador | Nombre, ciudad y servicio no se restauraban desde un enlace compartido. Se conservan en la dirección y se comprueban al recargar y volver desde un restaurante. |
| Enlaces de regreso | Algunos enlaces salían del HTML portátil; recuperar la cuenta regresaba al buscador. Ahora se conserva la demo, el ingreso real vuelve a /#login y la pantalla de emergencia tiene una ruta válida desde /r/nombre. |
| Colores propios | Con algunos grises tanto el texto claro como el marrón resultaban insuficientes. Se elige un color legible y se ajustan superficies, enlaces y texto secundario con contraste mínimo 4.5:1. Se comprueban 54 combinaciones y también el menú y carrito grises en el navegador. |
| Herramientas de auditoría | npm audit completo detectó cinco alertas moderadas en la cadena de Lighthouse 13.6/Sentry 11/glob/minimatch. Fijar Lighthouse 13.5.0 elimina esa cadena vulnerable; no se usó audit fix --force. La auditoría completa queda añadida a CI. |

## Diseño y uso diario

El panel usa espresso, azafrán y tonos de comida, tipografía de menú e ilustración de vajilla. Las métricas tienen jerarquía y acentos; la preparación muestra progreso real. Un bloque visible explica si la página está publicada, permite abrirla y lleva directamente al editor. Se revisaron computador, celular y modo oscuro.

Se conservaron la identidad de cada restaurante, sus colores, fotos, editor y borradores, contactos propios de WhatsApp/teléfono, pedidos, reservas, cocina, seguimiento y administración. Los enlaces para saltar al contenido, las cantidades con cifras alineadas y los espacios seguros del celular mejoran la navegación. Las capturas actualizadas están en capturas/.

## Skills recomendadas y fuentes

Se verificaron las fuentes públicas de **frontend-design** de Anthropic, **web-design-guidelines** de Vercel y **UI UX Pro Max**. La recomendación, enlaces y comandos están en [SKILLS_DISENO.md](../investigacion/SKILLS_DISENO.md). Se consultaron como documentación de diseño y revisión; no se ejecutaron sus herramientas para modificar el proyecto.

Las decisiones de las páginas públicas y de Sofía siguen documentadas en [PAGINAS_PUBLICAS_Y_VOZ.md](../investigacion/PAGINAS_PUBLICAS_Y_VOZ.md), y la arquitectura de restaurantes en [DECISIONES.md](../investigacion/DECISIONES.md). No se afirma un ranking mundial ni una inspección en vivo de todos los sitios de restaurantes.

## Producción y entrega

El contenedor verificó página pública, borrador, publicación, búsqueda y metadatos, cookie Secure, primera cuenta propietaria, registro cerrado y demo desactivada. Conservó datos y sesión tras reiniciar y comprobó copia de SQLite y fotografías.

La entrega ZIP se verifica por integridad, exclusión de archivos privados, extracción nueva, apertura del index sin API e instalación limpia del servidor empaquetado. La evidencia está en prueba-entrega.txt. La descarga de GitHub se comprueba por HTTP 200, versión, tamaño y SHA-256 en un enlace fijado al commit final.

## Alcance de las comprobaciones

La voz del navegador se probó con reconocimiento y síntesis simulados; los proveedores con respuestas controladas y webhooks firmados. No se usaron micrófono físico, llamada externa, correo real ni una clave de IA externa. Esas integraciones requieren configuración y prueba con las cuentas del operador.

Para atender clientes externos se necesita alojamiento HTTPS y disco persistente. Publicar desde localhost no crea un dominio en Internet. Las notificaciones requieren el panel abierto, y el seguimiento se actualiza mientras esté abierto o al consultarlo de nuevo. La llamada por WhatsApp se inicia desde la aplicación; la atención automática requiere Business Calling habilitado con el proveedor.

Los pagos se verifican manualmente, las reservas públicas requieren revisión del restaurante y el soporte lo atiende el operador de Cerca. Los datos de prueba no representan una prueba de carga de muchos locales operando simultáneamente. Las pruebas automáticas y la revisión no sustituyen una prueba operativa con los equipos y proveedores reales.

## Evidencias

- despues-axe.json, despues-lighthouse.json e ia-evaluacion.json.
- pruebas-api.txt, pruebas-navegador.txt, pruebas-resiliencia.txt y prueba-produccion.txt.
- dependencias-completas.json y dependencias-produccion.json: resultado final sin alertas conocidas. dependencias-antes-5.1.json conserva el hallazgo inicial.
- capturas/: panel, navegación móvil, editor, carta, pedidos, voz, cocina, reservas y administración.
- antes-*.json, ingreso-antes-axe.json, pruebas-restaurantes.txt y pruebas-paginas-publicas.txt son evidencia histórica de versiones anteriores.
- Repetir: npm run build, npm test, npm run test:e2e, npm run audit:assistant, npm run audit:site y npm audit. La revisión visual requiere Chromium.
