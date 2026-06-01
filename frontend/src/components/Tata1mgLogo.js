export default function Tata1mgLogo({ size = 36, dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="https://play-lh.googleusercontent.com/yjbAu08_Ahes38IEMV8slP91zgjh2mdh5xpZefvcbYuZxR8O7FZFderRn2Ivaz0uR2Lw"
        alt="Tata 1mg"
        style={{ width: size, height: size }}
        className="rounded-xl object-contain"
      />
      <div className="leading-none">
        <span className={`font-bold text-sm block ${dark ? "text-black" : "text-white"}`}>
          Tata 1mg
        </span>
        <span className={`text-xs block mt-0.5 ${dark ? "text-[#919093]" : "text-white/70"}`}>
          Video MER
        </span>
      </div>
    </div>
  );
}
