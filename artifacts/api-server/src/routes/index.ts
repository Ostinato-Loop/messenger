import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import conversationsRouter from "./conversations";
import messagesRouter from "./messages";
import rtcRouter from "./rtc";
import callsRouter from "./calls";
import notificationsRouter from "./notifications";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/conversations", conversationsRouter);
// Messages routes are nested under /conversations and /messages
router.use("/", messagesRouter);
router.use("/rtc", rtcRouter);
router.use("/rtc/calls", callsRouter);
router.use("/notifications", notificationsRouter);
router.use("/admin", adminRouter);

export default router;
