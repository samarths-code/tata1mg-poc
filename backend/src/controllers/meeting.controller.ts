import { Request, Response } from "express";
import fetch from "node-fetch";
import VideoSDKUtils from "../utils/videosdk.utils";
import MeetingStore from "../utils/store";

// Shared helper — also imported by webhook.controller
export async function notifyDoctor(url: string, payload: object): Promise<void> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`[notifyDoctor] Doctor callback returned ${res.status} for ${url}`);
    }
  } catch (err) {
    console.error("[notifyDoctor] Failed to reach doctor callback:", err);
  }
}

const MeetingController = {
  create: async (req: Request, res: Response) => {
    try {
      const { geoTag, notifyUrl, participantName } = req.body;

      const result = await VideoSDKUtils.createRoom(geoTag ?? null);
      if (!result) {
        return res.status(500).json({ message: "Failed to create VideoSDK room" });
      }

      // Only persist to store when server-side metadata is provided
      if (notifyUrl) {
        MeetingStore.set(result.roomId, {
          geoTag: geoTag ?? {},
          notifyUrl,
          participantName: participantName || "Participant",
          createdAt: new Date(),
        });
      }

      return res.status(200).json({
        roomId: result.roomId,
        token: result.token,
      });
    } catch (err) {
      console.error("[MeetingController.create]", err);
      return res.status(500).json({ message: "Something went wrong" });
    }
  },

};

export default MeetingController;
