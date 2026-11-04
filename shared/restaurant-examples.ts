import { menuExamples } from "./menu-examples.ts";
export const restaurantMenuExamples = [
  ...menuExamples,
  {
    name: "Sopa de la Casa",
    sku: "MENU-005",
    description:
      "Una sopa suave preparada al momento. Producto de demostración.",
    category: "Entradas",
    price: 14000,
    stock: 14,
    color: "sand",
    kind: "dish" as const,
    ingredients: "Agua, papa, zanahoria, cebolla y sal.",
    allergens:
      "La cocina manipula leche, trigo y huevo. Confirma posibles trazas con el equipo.",
  },
  {
    name: "Bowl Vegetariano",
    sku: "MENU-006",
    description: "Arroz y vegetales de la casa. Producto de demostración.",
    category: "Platos",
    price: 22000,
    stock: 9,
    color: "sage",
    kind: "dish" as const,
    ingredients: "Arroz, zanahoria, brócoli, maíz y salsa de soja.",
    allergens:
      "Contiene soja y trigo en la salsa. La cocina manipula otros alérgenos.",
  },
  {
    name: "Torta de Chocolate",
    sku: "MENU-007",
    description:
      "Una porción para cerrar con algo dulce. Producto de demostración.",
    category: "Postres",
    price: 12000,
    stock: 11,
    color: "peach",
    kind: "dish" as const,
    ingredients: "Harina de trigo, cacao, azúcar, leche, huevo y mantequilla.",
    allergens:
      "Contiene trigo, leche y huevo. Confirma posibles trazas con el equipo.",
  },
  {
    name: "Café de la Casa",
    sku: "MENU-008",
    description: "Café negro caliente. Producto de demostración.",
    category: "Bebidas",
    price: 5000,
    stock: 25,
    color: "sand",
    kind: "drink" as const,
    ingredients: "Agua y café molido.",
    allergens: "No se han confirmado posibles trazas; consulta al equipo.",
  },
];
