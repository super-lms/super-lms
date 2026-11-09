import authFetch from "./authFetch"

const LIVE_RTI_URL = "https://repository-name-cbc-rti-paper-trail-production.up.railway.app"

export async function openRtiStudentSupport(returnPath = "/dashboard") {
  const configuredUrl = String(import.meta.env.VITE_RTI_APP_URL || "").trim()
  const productionUrl = configuredUrl.startsWith("https://") ? configuredUrl : LIVE_RTI_URL
  const rtiUrl = import.meta.env.DEV && configuredUrl ? configuredUrl : productionUrl
  const popup = window.open("about:blank", "_blank")

  if (!popup) {
    window.alert("Your browser blocked the RTI window. Please allow pop-ups for SUPER LMS and try again.")
    return
  }
  popup.opener = null
  try {
    const response = await authFetch("/api/rti/sso")
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || "Unable to sign in to RTI. Please try again.")
    if (data.authentication === "rti_staff_login") throw new Error("Shared RTI sign-in is not configured yet. Contact your administrator; your SUPER LMS password does not automatically work in RTI's separate staff login.")
    if (!data.url) throw new Error("RTI did not return a sign-in link. Please contact your administrator.")
    const destination = new URL(data.url)
    const expected = new URL(rtiUrl)
    if (destination.origin !== expected.origin || (destination.protocol !== "https:" && !(import.meta.env.DEV && destination.protocol === "http:"))) {
      throw new Error("RTI returned an unexpected sign-in destination. Please contact your administrator.")
    }
    popup.location.replace(destination.toString())
    window.alert("RTI opened in a separate window. Please log out of RTI and close that window when finished.")
    window.location.assign(returnPath)
  } catch (error) {
    popup.close()
    throw error
  }
}
