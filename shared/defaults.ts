import type { Settings } from "../src/types.ts";
export const defaultSettings: Settings = {
  assistantName: "Sofía",
  active: true,
  tone: "cercano",
  voiceEnabled: true,
  voiceRate: 1,
  knowledge: [],
  rememberPreferences: true,
  description:
    "Un restaurante independiente en Colombia. Ofrecemos atención cercana y una carta que se actualiza con los datos del local.",
  timezone: "America/Bogota",
  hours:
    "Lunes a viernes de 12:00 m. a 10:00 p. m.; sábados y domingos de 12:00 m. a 10:00 p. m. (hora de Colombia). Confirma días festivos con el equipo.",
  shipping:
    "Los servicios de mesa, recogida y domicilio dependen de la configuración del restaurante. La zona y la tarifa de entrega se confirman antes de registrar el pedido.",
  returns:
    "Si hay un problema con tu pedido, escríbenos cuanto antes con su código y lo que ocurrió. El equipo revisará tu caso y confirmará la solución.",
  payments:
    "Los medios de pago se confirman con el equipo del restaurante. La plataforma no cobra automáticamente ni solicita contraseñas o códigos bancarios.",
  welcome:
    "¡Hola! Soy Sofía, la asistente virtual del restaurante 🌿 ¿Te ayudo a elegir, reservar una mesa o preparar un pedido?",
  faqs: [
    {
      id: "faq-ingredients",
      question: "¿Cómo conozco los ingredientes y alérgenos?",
      answer:
        "Dime qué plato te interesa y reviso los ingredientes registrados. Si tienes una alergia, confirma los ingredientes y posibles trazas con el equipo antes de consumir.",
    },
    {
      id: "faq-pickup",
      question: "¿Puedo recoger mi pedido?",
      answer:
        "Si el restaurante tiene habilitada la recogida, puedes seleccionar esa opción al preparar tu pedido. Confirma el horario con el equipo.",
    },
  ],
};
