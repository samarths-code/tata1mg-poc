export default function Tata1mgLogo({ height = 36, dark = false }) {
  return (
    <img
      src="/tata1mg-logo.svg"
      alt="TATA 1mg"
      height={height}
      width={Math.round(height * (124 / 36))}
      className={`object-contain ${dark ? "" : "brightness-0 invert"}`}
    />
  );
}
