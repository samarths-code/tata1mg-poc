import { Request, Response } from "express";
import MeetingStore from "../utils/store";
import { notifyDoctor } from "./meeting.controller";

const WebhookController = {
  handle: async (req: Request, res: Response) => {
    try {
      const event = req.body;

      console.log(`[Webhook] event=${event?.event} roomId=${event?.data?.roomId} sessionId=${event?.data?.id}`);

      // Acknowledge VideoSDK immediately — they retry if we don't respond fast.
      res.status(200).json({ received: true });

      const roomId = event?.data?.roomId;
      if (!roomId) return;

      const record = MeetingStore.get(roomId);

      switch (event.event) {
        case "session-started": {
          console.log(`[Webhook] Session started for room ${roomId}`);
          break;
        }

        case "recording-started": {
          console.log(`[Webhook] Recording started for room ${roomId}`);
          break;
        }

        case "session-ended": {
          console.log(`[Webhook] Session ended for room ${roomId}`);
          MeetingStore.delete(roomId);
          break;
        }
      }
    } catch (err) {
      console.error("[WebhookController.handle]", err);
      // res already sent above
    }
  },
};

export default WebhookController;
