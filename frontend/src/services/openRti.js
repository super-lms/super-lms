import authFetch from "./authFetch"

export async function openRtiStudentSupport() {
  const popup = window.open("about:blank", "_blank")

  try {
    const response = await authFetch("/api/rti/sso")
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.error || "Unable to open RTI / Student Support.")
    }

    if (!data.url) {
      throw new Error("RTI / Student Support did not return a sign-in link.")
    }

    if (popup) popup.location.href = data.url
    else window.location.assign(data.url)
  } catch (error) {
    if (popup) popup.close()
    throw error
  }
}
