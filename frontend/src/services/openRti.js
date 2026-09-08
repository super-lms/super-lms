const LIVE_RTI_URL = "https://repository-name-cbc-rti-paper-trail-production.up.railway.app"

export async function openRtiStudentSupport(returnPath = "/dashboard") {
  const configuredUrl = String(import.meta.env.VITE_RTI_APP_URL || "").trim()
  const productionUrl = configuredUrl.startsWith("https://") ? configuredUrl : LIVE_RTI_URL
  const rtiUrl = import.meta.env.DEV && configuredUrl ? configuredUrl : productionUrl
  const popup = window.open("about:blank", "_blank")

  if (popup) {
    popup.opener = null
    popup.location.replace(rtiUrl)
    window.alert(
      "RTI opened in a separate window. Please log out of RTI and close that window when finished."
    )
    window.location.assign(returnPath)
  } else {
    window.alert(
      "Your browser blocked the RTI window. Please allow pop-ups for SUPER LMS and try again."
    )
  }
}
