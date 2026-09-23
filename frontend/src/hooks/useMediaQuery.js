import { useEffect, useState } from "react";

// Minimal replacement for react-responsive's useMediaQuery({ minWidth, maxWidth }).
function toQuery({ minWidth, maxWidth }) {
  const parts = [];
  if (minWidth != null) parts.push(`(min-width: ${minWidth}px)`);
  if (maxWidth != null) parts.push(`(max-width: ${maxWidth}px)`);
  return parts.join(" and ") || "all";
}

export default function useMediaQuery(opts) {
  const query = toQuery(opts);
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
