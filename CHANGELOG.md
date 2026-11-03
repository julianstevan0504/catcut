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
