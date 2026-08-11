const browserHostname =
  typeof window === "undefined" ? "" : String(window.location.hostname || "").toLowerCase()

const usesSameOriginGateway = browserHostname.startsWith("sparkling-passion")

const API_BASE = usesSameOriginGateway
  ? ""
  : import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"

export default API_BASE
