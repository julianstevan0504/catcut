import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCatalogCsv,
  validateImport,
  quoteCsvCell,
} from "../shared/catalog.ts";

test("CSV de Excel con BOM, comas entre comillas y saltos de línea se interpreta correctamente", () => {
  const result = parseCatalogCsv(
    '\uFEFFnombre,sku,descripcion,categoria,precio,stock\r\n"Bolso, Alba",BA-01,"Lino\ny algodón",Accesorios,120000,4\r\n',
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.products[0].name, "Bolso, Alba");
  assert.equal(result.products[0].description, "Lino\ny algodón");
  assert.equal(result.products[0].stock, 4);
});
test("el importador acepta punto y coma y normaliza SKU sin modificar el stock", () => {
  const result = parseCatalogCsv(
    "nombre;sku;precio;stock\nProducto;ab-001;9900;0",
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.products[0].sku, "AB-001");
  assert.equal(result.products[0].stock, 0);
});
test("las filas inválidas y SKU repetidos se identifican antes de importar", () => {
  const result = parseCatalogCsv(
    "nombre,sku,precio,stock\nProducto,A-01,10000,2\nDuplicado,a-01,10000,3\nMalo,B-02,=SUM(A1),-1",
  );
  assert.equal(result.products.length, 1);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /repetido/);
});
test("se rechazan encabezados desconocidos, comillas rotas, archivos vacíos y exceso de filas", () => {
  for (const csv of [
    "nombre,sku,precio,__proto__\nP,A,10,1",
    'nombre,sku,precio,stock\n"Sin cerrar,A,10,1',
    "",
    "nombre,sku,precio,stock\n" +
      Array.from({ length: 501 }, (_, i) => `P,A-${i},10,1`).join("\n"),
  ])
    assert.throws(() => parseCatalogCsv(csv));
});
test("la validación de importación rechaza números no finitos, duplicados y actualizaciones ambiguas", () => {
  const p = { name: "A", sku: "A-01", price: 100, stock: 2 };
  assert.throws(
    () => validateImport({ products: [p, { ...p, sku: "a-01" }] }),
    /repite/,
  );
  assert.throws(
    () => validateImport({ products: [{ ...p, price: Infinity }] }),
    /precio/,
  );
  assert.throws(() =>
    validateImport({ products: [p], updateExisting: "true" }),
  );
});
test("la exportación CSV neutraliza fórmulas aunque empiecen con espacios o saltos de línea", () => {
  for (const value of [
    "=SUM(A1)",
    '  =HYPERLINK("https://example.test")',
    "\n+CMD",
    "\t@SUM(A1)",
    "-1+2",
  ])
    assert.ok(quoteCsvCell(value).startsWith("\"'"));
  assert.equal(quoteCsvCell('Algodón "natural"'), '"Algodón ""natural"""');
});
