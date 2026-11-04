import type { KnowledgeDocument } from "../src/types.ts";
// Only installed into a newly created demo, never into a real business.
export const businessExamples: KnowledgeDocument[] = [
  {
    id: "demo-mascotas",
    title: "Mascotas y terraza · ejemplo",
    content:
      "En esta tienda de demostración se permiten perros con correa en la terraza. Las mascotas no entran a la cocina. Para otra mascota o un espacio distinto, consulta al equipo.",
  },
  {
    id: "demo-conservacion",
    title: "Conservación y recalentado · ejemplo",
    content:
      "Pizza Margarita: en este ejemplo, la indicación registrada por la cocina es recalentar en horno a 180 °C durante 5 minutos.\n\nLa hamburguesa se prepara al momento. No se han registrado instrucciones de conservación para llevar; consúltalas con el equipo.",
  },
  {
    id: "demo-local",
    title: "Información del local · ejemplo",
    content:
      "Este es un restaurante ficticio para probar Cerca. La terraza es un espacio exterior. No hay dirección real, parqueadero, promociones ni información nutricional registrados. Los precios y productos del menú son datos de ejemplo. Las reservas de demostración no corresponden a mesas reales.",
  },
];
