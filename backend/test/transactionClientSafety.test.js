const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(filePath);
    if (!entry.isFile() || !entry.name.endsWith(".js")) return [];
    if (entry.name === "app.SCHEMA-ALIGNMENT-V1-STABLE.js") return [];
    return [filePath];
  });
}

test("transactions reserve one client instead of issuing BEGIN through the pool", () => {
  const backendRoot = path.resolve(__dirname, "..");
  const unsafe = [];

  for (const filePath of javascriptFiles(backendRoot)) {
    const source = fs.readFileSync(filePath, "utf8");
    if (/pool\.query\(\s*["'`]\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(source)) {
      unsafe.push(path.relative(backendRoot, filePath));
    }
  }

  assert.deepEqual(
    unsafe,
    [],
    "A transaction sent through pool.query can switch connections and leave locks behind. Use pool.connect(), then client.query() with release() in finally."
  );
});
