import { useEffect, useRef } from "react"
import { normalizePastedRichText, sanitizeRichText } from "../services/richText"

export function FormattedText({ value, fallback = "", style }) {
  const content = String(value || fallback || "")
  return (
    <div
      style={{ lineHeight: 1.55, overflowWrap: "anywhere", ...style }}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
    />
  )
}

export function RichTextEditor({ value, onChange, placeholder = "Enter a description." }) {
  const editorRef = useRef(null)

  useEffect(() => {
    const editor = editorRef.current
    if (!editor || document.activeElement === editor) return
    const safeValue = sanitizeRichText(value)
    if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue
  }, [value])

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus()
    document.execCommand(command, false, commandValue)
    onChange(editorRef.current?.innerHTML || "")
  }

  function addLink() {
    const url = window.prompt("Paste the web address for this link:", "https://")
    if (!url) return
    runCommand("createLink", url)
  }

  function pasteFormattedText(event) {
    event.preventDefault()
    const html = event.clipboardData.getData("text/html")
    const plainText = event.clipboardData.getData("text/plain")
    const image = Array.from(event.clipboardData.files || []).find(file => file.type === "image/png")
    if (!html && image && image.size <= 290000) {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
      const reader = new FileReader()
      reader.onload = () => {
        if (!editorRef.current?.isConnected) return
        editorRef.current.focus()
        if (range && editorRef.current.contains(range.commonAncestorContainer)) { const current = window.getSelection(); current.removeAllRanges(); current.addRange(range) }
        const imageHtml = `<img src="${reader.result}" alt="QR code" width="240" height="240">`
        const href = /^(https?:)\/\/[^\s<>"']+$/i.test(plainText.trim()) ? plainText.trim().replace(/&/g, "&amp;") : ""
        document.execCommand("insertHTML", false, sanitizeRichText(href ? `<p><a href="${href}">${imageHtml}</a></p><p><a href="${href}">Open quiz</a></p>` : `<p>${imageHtml}</p>`))
        onChange(editorRef.current.innerHTML)
      }
      reader.readAsDataURL(image)
      return
    }
    const normalized = normalizePastedRichText(html, plainText)
    document.execCommand("insertHTML", false, normalized)
    onChange(editorRef.current?.innerHTML || "")
  }

  const toolbarButton = (label, command, commandValue = null) => (
    <button
      key={`${command}-${commandValue || label}`}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => runCommand(command, commandValue)}
      style={toolbarButtonStyle}
    >
      {label}
    </button>
  )

  return (
    <div style={editorShellStyle}>
      <div style={toolbarStyle} aria-label="Description formatting controls">
        {toolbarButton("Paragraph", "formatBlock", "p")}
        {toolbarButton("Heading", "formatBlock", "h2")}
        {toolbarButton("Bold", "bold")}
        {toolbarButton("Italic", "italic")}
        {toolbarButton("Underline", "underline")}
        {toolbarButton("• Bullets", "insertUnorderedList")}
        {toolbarButton("1. Numbered", "insertOrderedList")}
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={addLink} style={toolbarButtonStyle}>Link</button>
        {toolbarButton("Clear formatting", "removeFormat")}
      </div>
      <div style={{padding:"6px 9px",fontSize:"0.85rem",color:"#4b5563"}}>Paste text or a copied quiz QR code here using Paste or Ctrl/Cmd+V.</div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onPaste={pasteFormattedText}
        style={editorStyle}
      />
    </div>
  )
}

const editorShellStyle = {
  border: "1px solid #9ca3af",
  borderRadius: "10px",
  overflow: "hidden",
  background: "#ffffff",
}

const toolbarStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  padding: "9px",
  borderBottom: "1px solid #d7dce5",
  background: "#f8fafc",
}

const toolbarButtonStyle = {
  border: "1px solid #cbd5e1",
  borderRadius: "7px",
  padding: "7px 10px",
  background: "#ffffff",
  color: "#172033",
  fontWeight: 700,
  cursor: "pointer",
}

const editorStyle = {
  minHeight: "220px",
  maxHeight: "360px",
  overflowY: "auto",
  padding: "14px",
  outline: "none",
  color: "#111827",
  lineHeight: 1.55,
}
