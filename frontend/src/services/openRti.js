const LIVE_RTI_URL = "https://repository-name-cbc-rti-paper-trail-production.up.railway.app"

export async function openRtiStudentSupport() {
  const configuredUrl = String(import.meta.env.VITE_RTI_APP_URL || "").trim()
  const productionUrl = configuredUrl.startsWith("https://") ? configuredUrl : LIVE_RTI_URL
  const rtiUrl = import.meta.env.DEV && configuredUrl ? configuredUrl : productionUrl
  const popup = window.open(rtiUrl, "_blank", "noopener,noreferrer")

  if (!popup) window.location.assign(rtiUrl)
}
