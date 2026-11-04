import type { ProductInput } from "./catalog.ts";
// Demonstration data only. Never insert these into an existing owner's store.
export const menuExamples: ProductInput[] = [
  {
    name: "Pizza Margarita",
    sku: "MENU-001",
    description: "Pizza de la casa de 25 cm. Datos de ejemplo.",
    category: "Pizzas",
    price: 28000,
    stock: 12,
    color: "peach",
    kind: "dish",
    ingredients: "Masa de trigo, salsa de tomate, queso mozzarella y albahaca.",
    allergens:
      "Trigo (gluten) y leche. La cocina también manipula otros alérgenos.",
  },
  {
    name: "Hamburguesa de la Casa",
    sku: "MENU-002",
    description: "Hamburguesa clásica. Datos de ejemplo.",
    category: "Hamburguesas",
    price: 24000,
    stock: 8,
    color: "sand",
    kind: "dish",
    ingredients:
      "Pan de trigo, carne de res, queso, lechuga, tomate y salsa de la casa.",
    allergens:
      "Trigo (gluten), leche y huevo en la salsa. Confirma con el equipo posibles trazas.",
  },
  {
    name: "Limonada Natural",
    sku: "MENU-003",
    description: "Vaso de 400 ml. Datos de ejemplo.",
    category: "Bebidas",
    price: 8000,
    stock: 20,
    color: "sage",
    kind: "drink",
    ingredients: "Agua, limón, azúcar y hielo.",
    allergens:
      "No hay información de alérgenos confirmada. Consulta al equipo.",
  },
  {
    name: "Ensalada Verde",
    sku: "MENU-004",
    description: "Ensalada del día. Datos de ejemplo.",
    category: "Ensaladas",
    price: 18000,
    stock: 0,
    color: "lavender",
    kind: "dish",
    ingredients: "Lechuga, pepino, tomate y aceite de oliva.",
    allergens:
      "No hay información de alérgenos confirmada. Consulta al equipo.",
  },
];
