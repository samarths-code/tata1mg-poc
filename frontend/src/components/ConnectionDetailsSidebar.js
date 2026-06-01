import React from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between text-sm leading-5 whitespace-nowrap">
      <span className="text-[#919093]">{label}</span>
      <span className="text-white ml-4 truncate max-w-[180px] text-right">{value || "—"}</span>
    </div>
  );
}

function SectionCard({ title, rows, children }) {
  return (
    <div className="border border-[rgba(255,255,255,0.05)] rounded-xl p-2 w-full">
      <p className="text-sm font-medium text-white leading-5 mb-2">{title}</p>
      <div className="h-px bg-[rgba(255,255,255,0.05)] mb-2" />
      {rows
        ? rows.map(({ label, value }) => (
            <div key={label} className="mt-1 first:mt-0">
              <InfoRow label={label} value={value} />
            </div>
          ))
        : children}
    </div>
  );
}

function DeviceList({ items, activeId }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-[rgba(255,255,255,0.05)] w-6 h-6 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-medium">{i + 1}</span>
            </div>
            <span className="text-white text-sm font-medium truncate">{item.label}</span>
          </div>
          {item.active && (
            <span className="text-[10px] text-[#bbf7d0] bg-[rgba(22,101,52,0.1)] border border-[rgba(22,101,52,0.5)] px-1.5 py-0.5 rounded-full shrink-0">
              Active
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ConnectionDetailsSidebar({ onClose, data = {} }) {
  const {
    cameras = [],
    microphones = [],
    audioOutputs = [],
    location = {},
    device = {},
    network = {},
  } = data;

  return (
    <div className="bg-[#101113] border-l border-[rgba(255,255,255,0.05)] h-full flex flex-col w-[400px] min-w-[320px] rounded-bl-3xl rounded-tl-3xl">
      {/* Header */}
      <div className="flex flex-col gap-2 p-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="flex-1 text-[18px] font-semibold text-white leading-[26px]">
            Connection Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[rgba(255,255,255,0.05)] transition-colors text-[#919093] hover:text-white"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-[#919093] leading-4">
          Review device, network, location, and connected hardware information.
        </p>
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.03)]" />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {/* Camera devices */}
        <div>
          <SectionCard title="Camera Devices">
            <DeviceList
              items={cameras.length ? cameras : [{ label: "No cameras detected", active: false }]}
            />
          </SectionCard>
        </div>

        {/* Microphones */}
        <div>
          <SectionCard title="Microphones">
            <DeviceList
              items={microphones.length ? microphones : [{ label: "No microphones detected", active: false }]}
            />
          </SectionCard>
        </div>

        {/* Audio output */}
        {audioOutputs.length > 0 && (
          <div>
            <SectionCard title="Audio Output">
              <DeviceList items={audioOutputs} />
            </SectionCard>
          </div>
        )}

        {/* Location */}
        <SectionCard
          title="Location"
          rows={[
            { label: "Latitude", value: location.latitude },
            { label: "Longitude", value: location.longitude },
            { label: "Region", value: location.region },
            { label: "Connection Type", value: location.connectionType },
          ]}
        />

        {/* Client device */}
        <SectionCard
          title="Client Device"
          rows={[
            { label: "Device", value: device.name },
            { label: "OS", value: device.os },
            { label: "Browser", value: device.browser },
            { label: "IP Type", value: device.ipType },
          ]}
        />

        {/* Network performance */}
        <SectionCard
          title="Network Performance"
          rows={[
            { label: "Download Speed", value: network.downloadSpeed },
            { label: "Upload Speed", value: network.uploadSpeed },
            { label: "Latency", value: network.latency },
            { label: "Connection Stability", value: network.stability },
            { label: "Signal Strength", value: network.signalStrength },
          ]}
        />
      </div>

      <div className="h-px bg-[rgba(255,255,255,0.03)]" />
    </div>
  );
}
