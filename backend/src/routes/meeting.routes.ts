import { Router } from "express";
import MeetingController from "../controllers/meeting.controller";

const router = Router();

router.post("/create", MeetingController.create);

export default router;
