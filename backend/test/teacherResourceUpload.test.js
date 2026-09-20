const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");
const express = require("express");
const jwt = require("jsonwebtoken");
const { authenticateJWT, requireRole } = require("../middleware/auth");
const { createTeacherResourceUpload, MAX_RESOURCE_BYTES } = require("../server/teacherResourceUpload");

test("teacher resource uploads enforce the per-file boundary and role access", async () => {
  const app = express();
  app.post("/upload", authenticateJWT, requireRole("teacher", "admin"),
    createTeacherResourceUpload().multiple, (req, res) => {
      res.json({ sizes: req.files.map((file) => file.size) });
    });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const token = (role) => jwt.sign({ role }, process.env.JWT_SECRET || "super-lms-development-secret-change-before-production");
  async function send(sizes, role = "teacher") {
    const boundary = "test-resource-boundary";
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port,
      path: "/upload", method: "POST", headers: {
        Authorization: `Bearer ${token(role)}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      } });
    const response = once(req, "response");
    const chunk = Buffer.alloc(1024 * 1024);
    for (const [index, size] of sizes.entries()) {
      req.write(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="test-${index}.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`);
      for (let remaining = size; remaining > 0; remaining -= chunk.length) {
        if (!req.write(chunk.subarray(0, Math.min(remaining, chunk.length)))) await once(req, "drain");
      }
      req.write("\r\n");
    }
    req.end(`--${boundary}--\r\n`);
    const [res] = await response;
    let body = "";
    for await (const chunk of res) body += chunk;
    return { status: res.statusCode, body: JSON.parse(body) };
  }
  try {
    const accepted = await send([MAX_RESOURCE_BYTES, 1]);
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.body.sizes, [MAX_RESOURCE_BYTES, 1]);
    assert.equal((await send([MAX_RESOURCE_BYTES + 1])).status, 413);
    assert.equal((await send(Array(21).fill(1))).status, 400);
    assert.equal((await send([], "student")).status, 403);
    assert.equal((await send([], "parent")).status, 403);
    assert.equal((await send([1], "admin")).status, 200);
  } finally {
    server.close();
    await once(server, "close");
  }
});
