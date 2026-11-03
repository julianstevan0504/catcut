import "dotenv/config";
import { createApp } from "./app.mjs";

const service = await createApp();
const port = Number(process.env.PORT ?? 3000);
const server = service.app.listen(port, process.env.HOST ?? "0.0.0.0", () =>
  console.log(`Cerca está escuchando en el puerto ${port}.`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      service.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
