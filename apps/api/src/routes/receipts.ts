import { Router } from "express";
import {
  ListReceiptsHandler,
  CreateReceiptHandler,
  GetReceiptUrlHandler,
} from "../handlers";
import { catchAsync } from "../lib/errors";

const router = Router();

router.get("/", catchAsync(ListReceiptsHandler.handle.bind(ListReceiptsHandler)));
router.post("/", catchAsync(CreateReceiptHandler.handle.bind(CreateReceiptHandler)));
router.get("/:sessionId/url", catchAsync(GetReceiptUrlHandler.handle.bind(GetReceiptUrlHandler)));

export default router;
