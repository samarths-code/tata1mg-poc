export default function Tata1mgLogo({ size = 36 }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="https://play-lh.googleusercontent.com/yjbAu08_Ahes38IEMV8slP91zgjh2mdh5xpZefvcbYuZxR8O7FZFderRn2Ivaz0uR2Lw"
        alt="Tata 1mg"
        style={{ width: size, height: size }}
        className="rounded-xl object-contain"
      />
      <div className="leading-none">
        <span className="text-white font-bold text-sm block">Tata 1mg</span>
        <span className="text-gray-900 text-xs block mt-0.5">Video MER</span>
      </div>
    </div>
  );
}
