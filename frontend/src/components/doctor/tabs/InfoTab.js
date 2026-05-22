import { useState } from "react";
import { usePubSub } from "@videosdk.live/react-sdk";
import { useMeetingAppContext } from "../../../context/MeetingAppContext";

function parseBrowser(ua = "") {
  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("Chrome")) return "Google Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  return "Unknown";
}

function parseOS(ua = "") {
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Windows NT")) return "Windows";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-300 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-600 text-right max-w-[60%] break-words">{value ?? "—"}</span>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-300 p-4 mb-4">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DeviceList({ devices, selectedLabel }) {
  if (!devices?.length) return <p className="text-xs text-gray-400 italic">None detected</p>;
  return (
    <div className="space-y-1.5">
      {devices.map((device, i) => {
        const label = typeof device === "string" ? device : device.label;
        const isSelected = label === selectedLabel;
        return (
          <div
            key={i}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${
              isSelected ? "bg-orange-450/10" : "bg-slate-50"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                isSelected ? "bg-orange-450 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1}
            </span>
            <span className={`flex-1 truncate ${isSelected ? "font-semibold text-orange-450" : "text-gray-600"}`}>
              {label}
            </span>
            {isSelected && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-orange-450 shrink-0">
                Active
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function InfoTab() {
  const { geoData } = useMeetingAppContext();
  const [deviceInfo, setDeviceInfo] = useState(null);

  usePubSub("DEVICE_INFO", {
    onMessageReceived: ({ payload }) => {
      setDeviceInfo((prev) => prev ? { ...prev, ...payload } : payload);
    },
    onOldMessagesReceived: (messages) => {
      const latest = messages[messages.length - 1];
      if (latest?.payload) setDeviceInfo(latest.payload);
    },
  });

  return (
    <div className="w-full h-full overflow-y-auto p-4">

      {/* Location */}
      <InfoCard title="Location">
        {geoData ? (
          <>
            <InfoRow label="Latitude"  value={geoData.latitude?.toFixed(6)} />
            <InfoRow label="Longitude" value={geoData.longitude?.toFixed(6)} />
            {geoData.accuracy && (
              <InfoRow label="Accuracy" value={`±${Math.round(geoData.accuracy)} m`} />
            )}
          </>
        ) : (
          <p className="text-xs text-gray-400">Waiting for location data…</p>
        )}
      </InfoCard>

      {/* Device */}
      {deviceInfo ? (
        <>
          <InfoCard title="Client Device">
            <InfoRow label="OS"      value={parseOS(deviceInfo.userAgent)} />
            <InfoRow label="Browser" value={parseBrowser(deviceInfo.userAgent)} />
            <InfoRow label="Network" value={deviceInfo.connection} />
            {deviceInfo.downloadSpeed && (
              <InfoRow label="Download" value={`${deviceInfo.downloadSpeed} Mbps`} />
            )}
            {deviceInfo.uploadSpeed && (
              <InfoRow label="Upload"   value={`${deviceInfo.uploadSpeed} Mbps`} />
            )}
            {deviceInfo.city && (
              <InfoRow label="Location" value={[deviceInfo.city, deviceInfo.region, deviceInfo.country].filter(Boolean).join(", ")} />
            )}
            {deviceInfo.ip && <InfoRow label="IP" value={deviceInfo.ip} />}
          </InfoCard>

          <InfoCard title="Cameras">
            <DeviceList
              devices={deviceInfo.cameras}
              selectedLabel={deviceInfo.selectedCameraLabel}
            />
          </InfoCard>

          <InfoCard title="Microphones">
            <DeviceList
              devices={deviceInfo.microphones}
              selectedLabel={deviceInfo.selectedMicLabel}
            />
          </InfoCard>
        </>
      ) : (
        <InfoCard title="Client Device">
          <p className="text-xs text-gray-400">Waiting for device data from client…</p>
        </InfoCard>
      )}

    </div>
  );
}
