import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function healthHandler(_req: import("express").Request, res: import("express").Response) {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
}

router.get("/health", healthHandler);
router.get("/healthz", healthHandler);

export default router;
