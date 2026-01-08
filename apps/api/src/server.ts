import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import * as OpenApiValidator from "express-openapi-validator";
import { readFileSync } from "fs";
import { parse } from "yaml";
import { join } from "path";
import receiptsRouter from "./routes/receipts";
import { globalErrorHandler } from "./lib/errors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

function loadOpenApiSpec(): { spec: object; path: string } {
  const paths = [
    join(__dirname, "..", "openapi.yaml"),
    join(__dirname, "..", "..", "openapi.yaml"),
  ];
  
  for (const p of paths) {
    try {
      const yaml = readFileSync(p, "utf-8");
      return { spec: parse(yaml), path: p };
    } catch {
      continue;
    }
  }
  throw new Error("Could not find openapi.yaml");
}

const { spec: openapiSpec, path: openapiPath } = loadOpenApiSpec();

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use(
  OpenApiValidator.middleware({
    apiSpec: openapiPath,
    validateRequests: true,
    validateResponses: false,
  })
);

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/receipts", receiptsRouter);

app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`🚀 EV Receipt API running at http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/docs`);
});

export default app;
