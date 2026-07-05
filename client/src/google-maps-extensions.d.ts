/// <reference types="@types/google.maps" />

declare namespace google.maps.geometry.spherical {
  function computeArea(path: google.maps.LatLng[] | google.maps.LatLngLiteral[]): number;
}

interface Window {
  google: typeof google;
}
