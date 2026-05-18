import { useState, useEffect } from "react";

const useGeolocation = () => {
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    timestamp: null,
    error: null,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
      }));
      return;
    }

    const handleSuccess = (position) => {
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        timestamp: position.timestamp ?? Date.now(),
        error: null,
      });
    };

    const handleError = (error) => {
      setLocation((prev) => ({
        ...prev,
        error: error.message,
      }));
    };

    // Initial fetch
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError);

    // Watch for changes
    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return location;
};

export default useGeolocation;
