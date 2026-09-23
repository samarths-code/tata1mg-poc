import useMediaQuery from "./useMediaQuery";

const useIsTab = () => {
  const isTablet = useMediaQuery({
    minWidth: 768,
    maxWidth: 1223, // 991,
  });

  return isTablet;
};

export default useIsTab;
