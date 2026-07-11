// Vinext 0.0.50 otherwise probes the page with an undefined searchParams
// object before the real request render. A route-local loading boundary skips
// that classifier probe and keeps request-time query validation authoritative.
export default function SceneCaptureLoading() {
  return null;
}
