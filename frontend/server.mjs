import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.join(directory, "dist")
const port = Number(process.env.PORT || 8080)
const proxyTarget = new URL(
  process.env.API_PROXY_TARGET ||
    (process.env.NODE_ENV === "production"
      ? "http://super-lms.railway.internal:3000"
      : "http://localhost:3000")
)

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function proxyRequest(request, response) {
  const transport = proxyTarget.protocol === "https:" ? https : http
  const headers = {
    ...request.headers,
    host: proxyTarget.host,
    "x-forwarded-host": request.headers.host || "",
    "x-forwarded-proto": "https",
  }

  const upstreamRequest = transport.request(
    {
      protocol: proxyTarget.protocol,
      hostname: proxyTarget.hostname,
      port: proxyTarget.port || (proxyTarget.protocol === "https:" ? 443 : 80),
      method: request.method,
      path: request.url,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
    }
  )

  upstreamRequest.setTimeout(30000, () => {
    upstreamRequest.destroy(new Error("SUPER LMS backend timed out"))
  })

  upstreamRequest.on("error", (error) => {
    console.error("Gateway request failed:", error.message)
    if (!response.headersSent) {
      response.writeHead(502, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      })
    }
    response.end(JSON.stringify({ error: "SUPER LMS service is temporarily unavailable" }))
  })

  request.pipe(upstreamRequest)
}

function serveFile(response, filePath) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      const indexPath = path.join(distDirectory, "index.html")
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      })
      fs.createReadStream(indexPath).pipe(response)
      return
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": filePath.includes(`${path.sep}assets${path.sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    })
    fs.createReadStream(filePath).pipe(response)
  })
}

const server = http.createServer((request, response) => {
  const requestPath = new URL(request.url || "/", "http://localhost").pathname

  if (requestPath === "/api" || requestPath.startsWith("/api/") || requestPath.startsWith("/uploads/")) {
    proxyRequest(request, response)
    return
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(requestPath)
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("Bad request")
    return
  }

  const relativePath = decodedPath.replace(/^\/+/, "")
  const resolvedPath = path.resolve(distDirectory, relativePath)
  const safePath = resolvedPath.startsWith(`${distDirectory}${path.sep}`)
    ? resolvedPath
    : path.join(distDirectory, "index.html")

  serveFile(response, safePath)
})

server.listen(port, "0.0.0.0", () => {
  console.log(`SUPER LMS frontend gateway running on port ${port}`)
})
