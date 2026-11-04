export type ProductInput = {
  image_id?: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  color: string;
  ingredients: string;
  allergens: string;
  kind: "product" | "dish" | "drink";
};
export class ValidationError extends Error {
  status = 400;
}
export function quoteCsvCell(value: string | number): string {
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+@\-]|^[\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function text(
  value: unknown,
  label: string,
  max: number,
  empty = false,
): string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.trim().length > max
  )
    throw new ValidationError(
      `Revisa ${label}: ${empty ? "hasta" : "entre 1 y"} ${max} caracteres.`,
    );
  return value.trim();
}
export function validateProduct(value: unknown): ProductInput {
  if (!value || typeof value !== "object")
    throw new ValidationError("El producto no es válido.");
  const p = value as Record<string, unknown>;
  if (
    p.image_id !== undefined &&
    (typeof p.image_id !== "string" ||
      (p.image_id !== "" && !/^[a-f0-9-]{36}$/.test(p.image_id)))
  )
    throw new ValidationError("La foto no es válida.");
  const aliases: Record<string, string> = {
    producto: "product",
    plato: "dish",
    bebida: "drink",
  };
  const kind = aliases[String(p.kind)] ?? p.kind ?? "product";
  if (!["product", "dish", "drink"].includes(String(kind)))
    throw new ValidationError("El tipo debe ser producto, plato o bebida.");
  for (const [key, max] of [
    ["price", 1000000000],
    ["stock", 1000000],
  ] as const) {
    if (
      typeof p[key] !== "number" ||
      !Number.isSafeInteger(p[key]) ||
      (p[key] as number) < 0 ||
      (p[key] as number) > max
    )
      throw new ValidationError(
        `${key === "price" ? "El precio" : "El stock"} debe ser un entero entre 0 y ${max}.`,
      );
  }
  return {
    image_id: p.image_id as string | undefined,
    name: text(p.name, "el nombre", 100),
    sku: text(p.sku, "el SKU", 40).toUpperCase(),
    description: text(p.description ?? "", "la descripción", 1000, true),
    category: text(p.category ?? "General", "la categoría", 80),
    price: p.price as number,
    stock: p.stock as number,
    color: ["sage", "sand", "peach", "lavender"].includes(String(p.color))
      ? String(p.color)
      : "sage",
    ingredients: text(p.ingredients ?? "", "los ingredientes", 1000, true),
    allergens: text(p.allergens ?? "", "los alérgenos", 500, true),
    kind: kind as ProductInput["kind"],
  };
}
export function validateImport(value: unknown): {
  products: ProductInput[];
  updateExisting: boolean;
} {
  const body = value as Record<string, unknown>;
  if (
    !body ||
    !Array.isArray(body.products) ||
    !body.products.length ||
    body.products.length > 500
  )
    throw new ValidationError("Importa entre 1 y 500 productos por archivo.");
  if (
    body.updateExisting !== undefined &&
    typeof body.updateExisting !== "boolean"
  )
    throw new ValidationError(
      "La opción de actualizar productos no es válida.",
    );
  const products = body.products.map(validateProduct),
    skus = new Set<string>();
  for (const p of products) {
    if (skus.has(p.sku))
      throw new ValidationError(
        `El SKU ${p.sku} se repite dentro del archivo.`,
      );
    skus.add(p.sku);
  }
  return { products, updateExisting: body.updateExisting === true };
}

export function parseCatalogCsv(csv: string): {
  products: ProductInput[];
  errors: string[];
} {
  if (csv.length > 1000000)
    throw new ValidationError(
      "El archivo supera 1 MB. Divide el catálogo en archivos más pequeños.",
    );
  csv = csv.replace(/^\uFEFF/, "");
  const firstLine = csv.split(/\r?\n/, 1)[0];
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i <= csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else if (c === undefined)
        throw new ValidationError("Hay una celda con comillas sin cerrar.");
      else cell += c;
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else if (c === delimiter || c === "\n" || c === undefined) {
      row.push(cell.replace(/\r$/, ""));
      cell = "";
      closed = false;
      if (c !== delimiter) {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else if (c === "\r" && (csv[i + 1] === "\n" || csv[i + 1] === undefined))
      continue;
    else if (closed && !/\s/.test(c))
      throw new ValidationError(
        "Hay texto inesperado después de una celda entre comillas.",
      );
    else if (!closed) cell += c;
  }
  const aliases: Record<string, string> = {
    nombre: "name",
    name: "name",
    sku: "sku",
    descripcion: "description",
    description: "description",
    categoria: "category",
    category: "category",
    precio: "price",
    price: "price",
    stock: "stock",
    color: "color",
    ingredientes: "ingredients",
    ingredients: "ingredients",
    alergenos: "allergens",
    allergens: "allergens",
    tipo: "kind",
    kind: "kind",
  };
  const headers = (rows.shift() ?? []).map(
    (h) =>
      aliases[
        h
          .trim()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
      ],
  );
  if (
    headers.some((h) => !h) ||
    new Set(headers).size !== headers.length ||
    !["name", "sku", "price", "stock"].every((h) => headers.includes(h))
  )
    throw new ValidationError(
      "Usa nombre, sku, precio y stock. Puedes agregar descripcion, categoria, color, tipo, ingredientes y alergenos.",
    );
  if (!rows.length || rows.length > 500)
    throw new ValidationError("El CSV debe contener entre 1 y 500 productos.");
  const products: ProductInput[] = [],
    errors: string[] = [],
    skus = new Set<string>();
  rows.forEach((r, i) => {
    try {
      if (r.length !== headers.length)
        throw new ValidationError(
          "La cantidad de columnas no coincide con el encabezado.",
        );
      const item: Record<string, unknown> = Object.fromEntries(
        headers.map((h, j) => [h, r[j]]),
      );
      for (const key of ["price", "stock"]) {
        if (!/^\d+$/.test(String(item[key]).trim()))
          throw new ValidationError(
            "Precio y stock deben ser números enteros, sin separadores de miles.",
          );
        item[key] = Number(item[key]);
      }
      const p = validateProduct(item);
      if (skus.has(p.sku))
        throw new ValidationError(`El SKU ${p.sku} está repetido.`);
      skus.add(p.sku);
      products.push(p);
    } catch (e) {
      errors.push(`Fila ${i + 2}: ${(e as Error).message}`);
    }
  });
  return { products, errors };
}
