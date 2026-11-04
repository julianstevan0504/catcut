# Páginas públicas, diseño gastronómico y voz · Cerca 5.0

Revisión de noviembre de 2026. El objetivo es que cada restaurante tenga una página pública administrada desde su cuenta, y que el cliente pueda encontrarlo, pedir y seguir su pedido sin entrar al panel privado.

## Fuentes y referencias

Se descargaron y leyeron estas fuentes públicas durante esta entrega (HTTP 200):

- [TastyIgniter, repositorio oficial](https://github.com/tastyigniter/TastyIgniter): su documentación presenta pedidos online y reservas para restaurantes. Se tomó como referencia reunir carta, pedidos y reservas en una misma experiencia.
- [Vercel Commerce, repositorio oficial](https://github.com/vercel/commerce): referencia de una tienda moderna con interfaces separadas del proveedor de comercio, carga por secciones y componentes de compra. Se aplicó la separación entre vista pública y gestión privada, con el servidor como autoridad para precios y existencias.
- [OWASP DOM based XSS Prevention Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.md): contextos HTML, atributos, URL y CSS. Se usaron textos escapados por React, metadatos HTML escapados, números validados y opciones de diseño acotadas.

Como referencias funcionales conocidas también se consideraron OpenTable (encontrar restaurante y reservar), BentoBox (identidad y contenido del local), Toast (cocina y operación) y los flujos de seguimiento habituales de plataformas de pedidos. No se realizó una inspección en vivo de todos esos sitios ni se afirma un ranking de «las mejores páginas del mundo». El diseño y el código de esta entrega son propios.

## Ideas implementadas

| Necesidad del restaurante o cliente | Implementación |
| --- | --- |
| Buscar «Mateo Papa» y abrir su carta | Buscador público por nombre, especialidades, ciudad y servicios, con paginación. Solo aparecen negocios publicados y activos. |
| Compartir una dirección propia | Ruta /r/nombre-del-restaurante con título, descripción y enlace canónico propios. Los enlaces antiguos por query siguen funcionando. |
| Crear una página sin saber diseñar | Preguntas de identidad, tipo de negocio, ciudad, especialidades, descripción y contacto; se genera un borrador con textos del propietario. |
| Cambiar la personalidad del sitio | Colores propios, tres tipografías, tamaño de letra, ancho, alineación, portada, carta en lista o tarjetas y orden de secciones. |
| Probar antes de mostrar cambios | Vista previa en computador/celular. Guardar borrador y publicar son operaciones separadas. Se detecta la revisión del borrador para evitar sobrescrituras simultáneas. |
| Ir a cargar el menú después de responder preguntas | El alta abre el generador. Navegar desde el editor hacia otra sección guarda el borrador válido antes de salir para conservar el trabajo. |
| Contactar al negocio correcto | WhatsApp y teléfono por restaurante. El acceso de llamada por WhatsApp explica cómo iniciarla desde el chat; no simula una llamada de navegador. |
| Recibir el pedido de Andrés con su dirección | El pedido llega al restaurante correspondiente con nombre, teléfono, productos, cantidades, total y dirección; se descuenta stock en servidor. |
| Enterarse de que llegó un pedido | Campana con avisos persistentes y contador; notificación opcional del navegador mientras el panel esté abierto. La notificación del sistema evita datos personales del cliente. |
| Saber si el pedido ya está en cocina | Seguimiento privado con etapas y avisos de cambio de estado cada cinco segundos mientras esté abierto. |
| Encontrar el panel del dueño de la plataforma | Enlace «Soy el dueño de la plataforma», ruta /admin, guía de activación y Administración → Restaurantes, con enlaces públicos y estado de publicación. |
| Conseguir un aspecto gastronómico más atractivo | Identidad cálida de terracota y crema, ilustraciones propias de comida, formas decorativas, jerarquía de textos, tarjetas y diseño móvil. |

## Seguridad aplicada

- El negocio de cada operación privada procede de la sesión. Cambiar el diseño no permite elegir otra cuenta ni concederse un rol.
- /admin es una pantalla de acceso; los datos de administración exigen autenticación y rol en el servidor. Se corrigió un error que convertía un acceso sin sesión en error 500 y ahora se conserva la respuesta 401.
- Las páginas sin publicar o suspendidas se ocultan del buscador; /r/nombre responde 404 y las API públicas no entregan la carta.
- Las fotos usadas solo en un borrador requieren sesión y no se pueden borrar si el borrador las utiliza. Las fotos publicadas se sirven cuando están vinculadas a la página o al menú.
- Colores con formato hexadecimal, tipografías de una lista, tamaño entre 14 y 22 px y secciones sin duplicados. No se acepta HTML ejecutable, CSS libre, scripts ni URLs arbitrarias para diseñar.
- Los metadatos del HTML se escapan. WhatsApp usa números con código de país y enlaces https://wa.me; la llamada telefónica usa un número saneado.
- Se calcula el contraste del texto y de los botones; se comprueban también fondos oscuros con colores claros y productos agotados.
- La lectura de notificaciones y su marcado se limita al restaurante autenticado. El enlace de seguimiento sigue siendo privado y no aparece en el buscador.

## Corrección del bucle de Sofía

El reconocimiento simultáneo podía interpretar fragmentos cortos de la propia voz como si fueran una consulta y cancelar la respuesta. La solución predeterminada es por turnos: se cierra el reconocimiento antes de hablar, se espera brevemente al terminar y luego se escucha al cliente. El botón «Interrumpir y hablar» cancela la reproducción y permite tomar el turno.

Quien utiliza auriculares puede activar la interrupción por voz. Se descartan fragmentos de la respuesta incluso si son cortos, y los eventos de un reconocimiento o una reproducción antiguos no pueden abrir un nuevo turno. Al silenciar el altavoz también se respeta la pausa antes de volver a escuchar. Las pruebas de navegador verifican que no haya un reconocedor activo durante la voz en el modo predeterminado.

Sofía consulta ahora también el nombre público, historia, descripción y especialidades del negocio. Mantiene contexto, presupuesto, comparaciones y búsqueda opcional con IA; no inventa datos que el dueño no haya cargado. No se ha probado audio físico ni una llamada externa real en esta entrega; las pruebas emplean reconocimiento y síntesis simulados y webhooks firmados.

## Alcance de publicación y avisos

Cada negocio tiene una página dentro del dominio donde se aloje Cerca. El servidor necesita HTTPS y almacenamiento persistente para clientes externos. El ZIP permite explorar una demo de navegador y ejecutar el servidor real con el iniciador. Publicar una página desde localhost no crea un dominio externo.

Las notificaciones se actualizan con el panel abierto; no se incluye Web Push con el navegador cerrado. El cliente ve el estado actualizado cuando su seguimiento está abierto o vuelve a consultarlo. WhatsApp, el remitente de llamadas automatizadas, la IA externa y el correo necesitan sus cuentas y configuración. La interacción de llamada por WhatsApp se inicia en la aplicación de WhatsApp.
