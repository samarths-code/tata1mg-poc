// Dark pill shell shared by bottom-bar controls (matches the Figma device pills).
export default function Pill({ children, className = "" }) {
  return (
    <div
      className={`flex items-center h-8 bg-[#1b1b1e] border border-[#303033] rounded-lg px-1 py-1 relative ${className}`}
      style={{
        boxShadow: "inset -1px -1px 1px 0px rgba(0,0,0,0.25)",
        filter: "drop-shadow(0px 4px 2px rgba(0,0,0,0.25))",
      }}
    >
      {children}
    </div>
  );
}
