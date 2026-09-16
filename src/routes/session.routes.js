
import {Router} from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { startSession, sendSessionMessage, getSession, getSessionMessages } from "../controllers/session.controller.js";
import { generateReport , getReport, getUserSessions} from "../controllers/generateReport.controller.js";

const router = Router();

router.post("/", verifyJWT, startSession);
router.get("/:sessionId", verifyJWT, getSession);
router.get("/:sessionId/messages", verifyJWT, getSessionMessages);
router.post("/:sessionId/messages", verifyJWT, sendSessionMessage);

router.post("/:sessionId/report", verifyJWT, generateReport);
router.get("/:sessionId/report", verifyJWT, getReport);
router.get("/sessions", verifyJWT, getUserSessions);

export default router;
