import type { Settings } from "../src/types.ts";
export const defaultSettings: Settings = {
  assistantName: "Sofía",
  active: true,
  tone: "cercano",
  voiceEnabled: true,
  voiceRate: 1,
  description: "Una tienda independiente de moda y accesorios en Colombia.",
  timezone: "America/Bogota",
  hours:
    "Lunes a viernes de 9:00 a. m. a 6:00 p. m. y sábados de 9:00 a. m. a 1:00 p. m. (hora de Colombia). Domingos y festivos no hay atención humana.",
  shipping:
    "Hacemos envíos a toda Colombia. El tiempo estimado es de 2 a 5 días hábiles. El costo se confirma con la dirección antes de la compra.",
  returns:
    "Puedes solicitar un cambio dentro de los 15 días siguientes a la entrega, con el producto sin usar y sus etiquetas. Escríbenos para revisar tu caso.",
  payments:
    "Aceptamos transferencia bancaria, Nequi y tarjetas mediante un enlace de pago que te envía una persona del equipo. Nunca pedimos contraseñas ni códigos de seguridad.",
  welcome:
    "¡Hola! Soy Sofía, la asistente virtual de la tienda 🌿 ¿Te ayudo con un producto o con tu pedido?",
  faqs: [
    {
      id: "faq-size",
      question: "¿Cómo puedo saber mi talla?",
      answer:
        "Dime qué prenda te gusta y te pongo en contacto con el equipo para confirmar sus medidas y ayudarte a elegir tu talla.",
    },
    {
      id: "faq-pickup",
      question: "¿Puedo recoger mi pedido?",
      answer:
        "Por ahora vendemos online y hacemos envíos. Si necesitas una entrega especial, te comunico con una persona del equipo.",
    },
  ],
};
