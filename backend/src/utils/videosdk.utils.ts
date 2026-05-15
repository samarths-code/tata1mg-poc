import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";
import config from "../../config.json";

const VideoSDKUtils = {
  generateToken(): string {
    const { apiKey, secretKey } = config.videosdk;
    return jwt.sign(
      { apikey: apiKey, permissions: ["allow_join", "allow_mod"] },
      secretKey,
      { expiresIn: "24h", algorithm: "HS256" }
    );
  },

  // Uses customRoomId so we know the roomId upfront and can build templateUrl before the API call.
  // geoTag is optional — omit it when the meeting is created from the frontend directly.
  async createRoom(geoTag?: object | null): Promise<{ roomId: string; token: string } | null> {
    try {
      const token = VideoSDKUtils.generateToken();
      const roomId = `cls-${uuidv4().replace(/-/g, "").slice(0, 12)}`;

      let templateUrl = `${config.videosdk.templateUrl}?meetingId=${roomId}&token=${token}`;
      if (geoTag) {
        const geoTagParam = encodeURIComponent(
          Buffer.from(JSON.stringify(geoTag)).toString("base64")
        );
        templateUrl += `&geoTag=${geoTagParam}`;
      }

      const body = {
        customRoomId: roomId,
        autoStartConfig: {
          recording: {
            onFailure: {
              waitTime: 30,
              action: "close-room",
            },
            templateUrl,
            config: {
              quality: "high",
            },
          },
        },
        autoCloseConfig: {
          type: "session-end-and-deactivate",
          duration: 10,
        },
        webhook: {
          endPoint: config.webhook.endPoint,
          events: [
            "session-started",
            "session-ended",
            "recording-started",
            "recording-stopped",
          ],
        },
      };

      const response = await fetch(config.videosdk.roomUrl, {
        method: "POST",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const err = await response.json();
        console.error("[VideoSDK] createRoom failed:", err);
        return null;
      }

      const data: any = await response.json();
      return { roomId: data.roomId, token };
    } catch (err) {
      console.error("[VideoSDK] createRoom exception:", err);
      return null;
    }
  },
};

export default VideoSDKUtils;
