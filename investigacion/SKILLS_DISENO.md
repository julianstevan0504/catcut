# Skills de diseño para Cerca · revisión del 4 de noviembre de 2026

Una skill aporta instrucciones al asistente que modifica el código. Para este proyecto conviene empezar con frontend-design y usar web-design-guidelines para revisar el resultado.

| Skill | Para qué sirve aquí | Repositorio verificado |
| --- | --- | --- |
| **frontend-design**, de Anthropic | Dirección visual, tipografía, composición y una identidad propia para el restaurante y su panel. Primera recomendación para mejorar el aspecto. | [anthropics/skills · frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) |
| **web-design-guidelines**, de Vercel | Revisión de accesibilidad, teclado, formularios, foco, imágenes, errores y navegación. Complementa el diseño visual. | [vercel-labs/agent-skills · web-design-guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) |
| **UI UX Pro Max** | Búsqueda de estilos, paletas y combinaciones tipográficas; generación de reglas de diseño para distintos tipos de producto. Opción adicional para explorar propuestas. | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) |

## Instalación con la CLI de Skills

En la terminal del proyecto, con Node.js instalado:

```bash
npx skills add anthropics/skills --skill frontend-design
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
```

Selecciona Codex si el instalador pregunta para qué asistente las quieres. Son dos skills complementarias; empieza por frontend-design si solo vas a elegir una. Los comandos se contrastaron con la documentación de [vercel-labs/skills](https://github.com/vercel-labs/skills).

UI UX Pro Max tiene su propia CLI y documenta la opción `uipro init --ai codex`. Sigue las instrucciones actuales de su README si eliges esa alternativa.

## Cómo se usaron las referencias en esta revisión

Se descargaron y leyeron el SKILL.md de frontend-design, el SKILL.md de web-design-guidelines, la guía de interfaces de Vercel, el README de UI UX Pro Max y la documentación de la CLI de Skills. Las cinco consultas respondieron HTTP 200. Se consultó su documentación; las herramientas de los repositorios no se ejecutaron para modificar Cerca.

La dirección elegida mantiene la identidad cálida del producto y da al panel de trabajo un tono espresso, acentos de azafrán y una ilustración de vajilla. La página pública conserva los colores de cada restaurante. Se mejoraron jerarquía, publicación, progreso de preparación, contraste, foco móvil, búsqueda y mensajes de error, sin añadir reseñas, ventas o cifras ficticias.

Fuentes leídas:

- https://raw.githubusercontent.com/anthropics/skills/main/skills/frontend-design/SKILL.md
- https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
- https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/README.md
- https://raw.githubusercontent.com/vercel-labs/skills/main/README.md
