export function downloadCodes(codes: string[]) {
  const data =
    "CERCA RESTAURANTES · CÓDIGOS DE RECUPERACIÓN\n\nGuárdalos en un lugar privado. Cada código se puede usar una vez junto a tu correo para restablecer tu contraseña. No los compartas con soporte.\n\n" +
    codes.join("\n");
  const url = URL.createObjectURL(
      new Blob([data], { type: "text/plain;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "cerca-codigos-recuperacion.txt";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
