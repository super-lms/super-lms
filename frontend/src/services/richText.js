const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H2", "H3", "UL", "OL", "LI", "A", "IMG"])

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function hasRichTextMarkup(value) {
  return /<\/?(?:p|br|strong|b|em|i|u|h2|h3|ul|ol|li|a|img)\b/i.test(String(value || ""))
}

export function sanitizeRichText(value) {
  const source = String(value || "").trim()
  if (!source) return ""
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return escapeHtml(source).replace(/\n/g, "<br>")
  }
  if (!hasRichTextMarkup(source)) {
    return escapeHtml(source).replace(/\n/g, "<br>")
  }

  const documentNode = new window.DOMParser().parseFromString(`<div>${source}</div>`, "text/html")
  const root = documentNode.body.firstElementChild

  function clean(node) {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== window.Node.ELEMENT_NODE) return
      if (!ALLOWED_TAGS.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(child.tagName)) { child.remove(); return }
        clean(child)
        child.replaceWith(...Array.from(child.childNodes))
        return
      }

      const originalSrc = child.tagName === "IMG" ? child.getAttribute("src") || "" : ""
      const originalAlt = child.tagName === "IMG" ? child.getAttribute("alt") || "QR code" : ""
      const originalHref = child.tagName === "A" ? child.getAttribute("href") || "" : ""
      Array.from(child.attributes).forEach((attribute) => child.removeAttribute(attribute.name))
      if (child.tagName === "IMG") {
        if (!/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(originalSrc) || originalSrc.length > 400000) { child.remove(); return }
        child.setAttribute("src", originalSrc)
        child.setAttribute("alt", originalAlt.slice(0, 300))
        child.setAttribute("width", "240")
        child.setAttribute("height", "240")
        child.setAttribute("style", "max-width:100%;height:auto")
      }
      if (child.tagName === "A") {
        const safeHref = /^(https?:|mailto:)/i.test(originalHref) ? originalHref : ""
        if (safeHref) {
          child.setAttribute("href", safeHref)
          child.setAttribute("target", "_blank")
          child.setAttribute("rel", "noreferrer")
        }
      }
      clean(child)
    })
  }

  clean(root)
  return root.innerHTML
}

export function normalizePastedRichText(html, plainText = "") {
  const source = String(html || "").trim()
  if (!source || typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return sanitizeRichText(plainText)
  }

  const documentNode = new window.DOMParser().parseFromString(`<div>${source}</div>`, "text/html")
  const root = documentNode.body.firstElementChild

  function wrapContents(element, tagName) {
    const wrapper = documentNode.createElement(tagName)
    while (element.firstChild) wrapper.appendChild(element.firstChild)
    element.appendChild(wrapper)
  }

  Array.from(root.querySelectorAll("*"))
    .reverse()
    .forEach((element) => {
      const style = String(element.getAttribute("style") || "").toLowerCase()
      if (/font-weight\s*:\s*(?:bold|[6-9]00)/.test(style)) wrapContents(element, "strong")
      if (/font-style\s*:\s*italic/.test(style)) wrapContents(element, "em")
      if (/text-decoration(?:-line)?\s*:[^;]*underline/.test(style)) wrapContents(element, "u")
    })

  Array.from(root.querySelectorAll("div")).forEach((element) => {
    const paragraph = documentNode.createElement("p")
    while (element.firstChild) paragraph.appendChild(element.firstChild)
    element.replaceWith(paragraph)
  })

  let activeList = null
  let activeListType = ""
  Array.from(root.children).forEach((element) => {
    const className = String(element.getAttribute("class") || "")
    const style = String(element.getAttribute("style") || "")
    const isWordList = /msolistparagraph/i.test(className) || /mso-list\s*:/i.test(style)
    if (!isWordList) {
      activeList = null
      activeListType = ""
      return
    }

    const marker = element.querySelector('[style*="mso-list:Ignore"], [style*="mso-list:ignore"]')
    const markerText = String(marker?.textContent || "").trim()
    const listType = /^(?:\d+|[a-z])[.)]/i.test(markerText) ? "ol" : "ul"
    marker?.remove()

    if (!activeList || activeListType !== listType) {
      activeList = documentNode.createElement(listType)
      activeListType = listType
      element.before(activeList)
    }

    const item = documentNode.createElement("li")
    while (element.firstChild) item.appendChild(element.firstChild)
    activeList.appendChild(item)
    element.remove()
  })

  return sanitizeRichText(root.innerHTML)
}
