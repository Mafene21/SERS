export function captureCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("Location needs a secure connection. Open SERS over HTTPS or on localhost, then retry."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("This browser does not provide location services. Turn on device location and retry."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (
          !Number.isFinite(coords.latitude) ||
          !Number.isFinite(coords.longitude) ||
          coords.accuracy > 10000
        ) {
          reject(new Error("Your location could not be confirmed accurately. Move to an area with a clearer signal and retry."));
          return;
        }
        resolve({ latitude: coords.latitude, longitude: coords.longitude });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "SERS needs location access to send this report. Allow location in your browser settings, then retry."
            : error.code === error.TIMEOUT
              ? "Location took too long to respond. Check device location and retry."
              : "SERS could not get your location. Turn on device location and retry.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 },
    );
  });
}
