# Cerca Restaurantes 5.0 · Revisión de funcionamiento, IA y sitio

Medición de accesibilidad: 2026-11-04T20:35:55.839Z. Se usaron cuentas y datos de prueba.

## Resultado

- **90/90 pruebas de API, datos, seguridad y asistente**. Incluyen aislamiento entre restaurantes, publicación y borradores, búsqueda con tildes, revisiones simultáneas, fotos privadas, permisos de administración, avisos de pedidos y seguimiento, además de stock, capacidad, recuperación y webhooks.
- **22/22 pruebas de navegador** en la compilación final: registro, editor de páginas, búsqueda de «Mateo Papa», contactos del negocio, pedido de Andrés, aviso al dueño, cambio visible a «En cocina», administración, soporte, reservas y voz. El recorrido del editor comprueba que ir a cargar el menú conserva el borrador.
- **33/33 casos en el analizador local de respuestas**: precios, ingredientes, alérgenos, preguntas relacionadas, presupuesto, personas, contexto, variantes inexistentes, cálculos y privacidad. Los proveedores de IA se simulan; no es una evaluación externa de un modelo real.
- **0 infracciones detectadas por axe en 54 vistas**, incluyendo buscador y editor, colores personalizados, administración, guía de llamada por WhatsApp, asistente, cocina, reservas, menú público y variantes móvil/oscura.
- **0 errores de JavaScript** registrados y **ningún desbordamiento horizontal** en las vistas revisadas.
- **0 vulnerabilidades conocidas** reportadas por npm audit en las dependencias de producción de esta entrega.

| Lighthouse de escritorio · demo portátil servida localmente | Puntuación |
| --- | ---: |
| Rendimiento | 98 |
| Accesibilidad | 100 |
| Buenas prácticas | 100 |
| SEO | 100 |

Son mediciones locales: pueden variar con el dispositivo y alojamiento. El HTML portátil incluye el código para abrirlo con doble clic; el servidor carga las pantallas por secciones. Los resultados automáticos no certifican accesibilidad completa ni ausencia de vulnerabilidades.

## Páginas públicas y operación del restaurante

Cada restaurante dispone de una ruta /r/nombre, buscable por nombre, especialidades, ciudad y servicios. Su dueño responde preguntas de identidad y contacto para generar la página; puede editar textos, fotos, colores, tipografía, tamaño, portada, carta y orden de secciones. Guardar borrador, publicar y retirar la página son operaciones separadas. La revisión del borrador evita sobrescribir cambios simultáneos.

El cliente ve los datos publicados y los contactos del restaurante correspondiente. Los pedidos conservan nombre, teléfono, productos y dirección para el equipo autorizado. La campana consulta avisos persistentes y el seguimiento privado muestra las etapas, incluido «En cocina». Ambos se actualizan cada cinco segundos mientras estén abiertos. La notificación del sistema es opcional y evita datos personales del cliente.

La identidad visual utiliza terracota, crema, formas e ilustraciones propias de comida. Se corrigieron problemas de contraste en avisos, categorías, agotados y colores personalizados; la revisión final incluye fondos claros y oscuros. También se corrigió el proxy de fotos en desarrollo y se comprueba que las imágenes realmente se decodifican.

El acceso «Soy el dueño de la plataforma» y /admin conduce a administración. La activación exige cuenta, contraseña y clave privada de instalación; registrarse como restaurante no otorga ese rol. Administración → Restaurantes muestra cantidades, estado y enlaces públicos. Se corrigió un error de autorización que producía un 500 sin sesión; ahora responde 401, y las cuentas sin rol reciben 403.

## Sofía y seguridad

Sofía pausa el reconocimiento antes de hablar y espera brevemente al terminar para escuchar. «Interrumpir y hablar» cancela la voz y permite tomar el turno. La interrupción por voz es opcional para usar con auriculares. Se rechazan fragmentos cortos de la propia respuesta y eventos antiguos. Las pruebas simulan estos eventos y comprueban que el reconocimiento esté detenido durante la reproducción en el modo predeterminado.

El asistente consulta también nombre público, historia, descripción y especialidades del local. Conserva contexto y relaciona productos, presupuestos y documentos sin inventar precios, ingredientes ni existencias. El proveedor opcional propone búsquedas acotadas; el servidor valida identificadores y redacta los hechos a partir de los datos del negocio.

Se mantienen contraseñas scrypt, sesiones opacas, cookies protegidas, CSRF, CSP con nonce, cifrado de integraciones, validación de fotografías y aislamiento entre cuentas. El editor admite opciones de diseño acotadas: no ejecuta HTML, CSS libre ni scripts del dueño. Los metadatos públicos se escapan; WhatsApp usa números validados. Las fotos de borradores permanecen privadas y el buscador excluye páginas sin publicar o suspendidas.

Las fuentes y decisiones están en [PAGINAS_PUBLICAS_Y_VOZ.md](../investigacion/PAGINAS_PUBLICAS_Y_VOZ.md) y [DECISIONES.md](../investigacion/DECISIONES.md). Se leyeron documentación pública de TastyIgniter, Vercel Commerce y OWASP; no se afirma haber auditado todos los grandes sitios de restaurantes ni un ranking mundial.

## Producción y entrega

El contenedor verificó páginas públicas, borrador, publicación, buscador y metadatos, además de demo desactivada, cookie Secure, primera cuenta propietaria y registro cerrado. Se conservaron sesión y datos después de reiniciar; se comprobó la copia de SQLite y fotos.

El ZIP se comprueba por SHA-256, integridad, exclusión de archivos privados, extracción nueva, apertura del index sin API e instalación limpia del servidor empaquetado. La evidencia se adjunta en prueba-entrega.txt. La descarga publicada se verifica también desde una dirección de GitHub fijada al commit entregado.

## Activación y límites

No se hicieron llamadas telefónicas reales, pruebas de micrófono físico, envíos reales de correo ni consultas a un modelo con clave externa. Se usaron reconocimiento y síntesis simulados, webhooks firmados de Twilio/Meta y proveedores simulados. Para atender clientes externos hacen falta alojamiento HTTPS, disco persistente y datos reales del restaurante. El ZIP por sí solo no publica un servidor en Internet.

«Llamar por WhatsApp» abre una guía y el chat correcto: el cliente inicia la llamada desde WhatsApp. La recepción automática por WhatsApp requiere habilitar Business Calling con el proveedor. Meta, Twilio, OpenAI y Resend necesitan sus respectivas cuentas si se usan. La recuperación por códigos funciona sin correo.

Las notificaciones requieren el panel abierto; no se incluye Web Push con el navegador cerrado. El dictado depende del navegador y hardware. Las reservas públicas requieren confirmación del equipo; los pagos se verifican manualmente. El soporte lo atiende el operador de la plataforma. SQLite utiliza una instancia con disco persistente; los datos de prueba no representan una prueba de carga de muchos locales operando simultáneamente.

## Evidencias y repetición

- despues-axe.json, despues-lighthouse.json, ia-evaluacion.json y dependencias-produccion.json.
- pruebas-api.txt, pruebas-navegador.txt, pruebas-paginas-publicas.txt y prueba-produccion.txt.
- capturas/: buscador, editor, contactos, asistente, cocina, reservas, soporte, administración y menús.
- antes-*.json, ingreso-antes-axe.json y pruebas-restaurantes.txt son evidencia histórica de versiones anteriores.
- Comandos: npm run build, npm test, npm run test:e2e, npm run audit:assistant y npm run audit:site (Chromium necesario).
