import useMediaQuery from "./useMediaQuery";

const useIsMobile = (maxWidth) => {
  const isMobile = useMediaQuery({ maxWidth: maxWidth || 767 });
  return isMobile;
};

export default useIsMobile;
