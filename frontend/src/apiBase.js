const browserHostname =
  typeof window === "undefined" ? "" : String(window.location.hostname || "").toLowerCase()

const configuredBasePath = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "")
const usesPrefixedGateway = configuredBasePath && configuredBasePath !== "/"
const usesSameOriginGateway = browserHostname.startsWith("sparkling-passion")

const API_BASE = usesPrefixedGateway
  ? `${configuredBasePath}-gateway`
  : usesSameOriginGateway
    ? ""
    : import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"

export default API_BASE
