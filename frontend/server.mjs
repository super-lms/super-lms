import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.join(directory, "dist")
const port = Number(process.env.PORT || 8080)
const configuredBasePath = String(process.env.VITE_APP_BASE_PATH || "/")
const appBasePath =
  configuredBasePath === "/"
    ? "/"
    : `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`
const gatewayPrefix = appBasePath === "/" ? "" : `${appBasePath}-gateway`
const proxyTarget = new URL(
  process.env.API_PROXY_TARGET ||
    (process.env.NODE_ENV === "production"
      ? "http://super-lms.railway.internal:3000"
      : "http://localhost:3000")
)
const legacyAppTarget = process.env.LEGACY_APP_PROXY_TARGET
  ? new URL(process.env.LEGACY_APP_PROXY_TARGET)
  : null

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

function proxyRequest(request, response, target, upstreamPath = request.url) {
  const transport = target.protocol === "https:" ? https : http
  const headers = {
    ...request.headers,
    host: target.host,
    "x-forwarded-host": request.headers.host || "",
    "x-forwarded-proto": "https",
  }

  const upstreamRequest = transport.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: request.method,
      path: upstreamPath,
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

function proxyLegacyRequest(request, response) {
  const transport = legacyAppTarget.protocol === "https:" ? https : http
  const headers = {
    ...request.headers,
    host: legacyAppTarget.host,
    "x-forwarded-host": request.headers.host || "",
    "x-forwarded-proto": "https",
  }
  delete headers["accept-encoding"]

  const upstreamRequest = transport.request(
    {
      protocol: legacyAppTarget.protocol,
      hostname: legacyAppTarget.hostname,
      port: legacyAppTarget.port || (legacyAppTarget.protocol === "https:" ? 443 : 80),
      method: request.method,
      path: request.url,
      headers,
    },
    (upstreamResponse) => {
      const contentType = String(upstreamResponse.headers["content-type"] || "")
      const rewritesBrowserApiOrigin = contentType.includes("javascript")

      if (!rewritesBrowserApiOrigin) {
        response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
        upstreamResponse.pipe(response)
        return
      }

      const chunks = []
      upstreamResponse.on("data", (chunk) => chunks.push(chunk))
      upstreamResponse.on("end", () => {
        const body = Buffer.concat(chunks)
          .toString("utf8")
          .replaceAll(legacyAppTarget.origin, "")
        const responseHeaders = { ...upstreamResponse.headers }
        delete responseHeaders["content-encoding"]
        delete responseHeaders["content-length"]
        delete responseHeaders.etag
        responseHeaders["cache-control"] = "no-cache"
        responseHeaders["content-length"] = Buffer.byteLength(body)
        response.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
        response.end(body)
      })
    }
  )

  upstreamRequest.setTimeout(30000, () => {
    upstreamRequest.destroy(new Error("Emergency Upload service timed out"))
  })

  upstreamRequest.on("error", (error) => {
    console.error("Emergency Upload gateway failed:", error.message)
    if (!response.headersSent) {
      response.writeHead(502, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      })
    }
    response.end(JSON.stringify({ error: "Emergency Upload service is temporarily unavailable" }))
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
  const requestUrl = new URL(request.url || "/", "http://localhost")
  const requestPath = requestUrl.pathname

  if (gatewayPrefix && (requestPath === gatewayPrefix || requestPath.startsWith(`${gatewayPrefix}/`))) {
    const upstreamPath = `${requestPath.slice(gatewayPrefix.length) || "/"}${requestUrl.search}`
    proxyRequest(request, response, proxyTarget, upstreamPath)
    return
  }

  if (
    appBasePath === "/" &&
    (requestPath === "/api" || requestPath.startsWith("/api/") || requestPath.startsWith("/uploads/"))
  ) {
    proxyRequest(request, response, proxyTarget)
    return
  }

  if (
    appBasePath !== "/" &&
    legacyAppTarget &&
    (requestPath === "/api" || requestPath.startsWith("/api/") || requestPath.startsWith("/uploads/"))
  ) {
    proxyLegacyRequest(request, response)
    return
  }

  const servesSuperLms =
    appBasePath === "/" || requestPath === appBasePath || requestPath.startsWith(`${appBasePath}/`)

  if (!servesSuperLms && legacyAppTarget) {
    proxyLegacyRequest(request, response)
    return
  }

  if (!servesSuperLms) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("Not found")
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

  const appPath = appBasePath === "/" ? decodedPath : decodedPath.slice(appBasePath.length) || "/"
  const relativePath = appPath.replace(/^\/+/, "")
  const resolvedPath = path.resolve(distDirectory, relativePath)
  const safePath = resolvedPath.startsWith(`${distDirectory}${path.sep}`)
    ? resolvedPath
    : path.join(distDirectory, "index.html")

  serveFile(response, safePath)
})

server.listen(port, "0.0.0.0", () => {
  console.log(`SUPER LMS frontend gateway running on port ${port}`)
})
