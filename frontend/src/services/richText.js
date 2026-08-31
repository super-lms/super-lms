const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "H2", "H3", "UL", "OL", "LI", "A"])

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function hasRichTextMarkup(value) {
  return /<\/?(?:p|br|strong|b|em|i|u|h2|h3|ul|ol|li|a)\b/i.test(String(value || ""))
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
        child.replaceWith(...Array.from(child.childNodes))
        return
      }

      const originalHref = child.tagName === "A" ? child.getAttribute("href") || "" : ""
      Array.from(child.attributes).forEach((attribute) => child.removeAttribute(attribute.name))
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
