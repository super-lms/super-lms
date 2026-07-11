const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const xlsx = require("xlsx");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "rubric-imports");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]+/g, " ")
    .replace(/\n[ ]+/g, "\n")
    .trim();
}

function splitLines(text) {
  return cleanText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function guessLevelCount(lines) {
  const joined = lines.join(" ").toLowerCase();

  const sixLevelSignals = ["6", "level 6", "six levels"];
  const fiveLevelSignals = ["5", "level 5", "five levels"];
  const fourLevelSignals = ["4", "level 4", "four levels"];

  if (sixLevelSignals.some((signal) => joined.includes(signal)) && joined.includes("level")) {
    return 6;
  }

  if (fiveLevelSignals.some((signal) => joined.includes(signal)) && joined.includes("level")) {
    return 5;
  }

  if (fourLevelSignals.some((signal) => joined.includes(signal)) && joined.includes("level")) {
    return 4;
  }

  return 4;
}

function isLikelyHeading(line) {
  const lower = line.toLowerCase();

  if (line.length > 90) return false;

  return (
    lower.includes("criterion") ||
    lower.includes("criteria") ||
    lower.includes("learning standard") ||
    lower.includes("performance") ||
    lower.includes("level") ||
    lower.includes("exceed") ||
    lower.includes("proficient") ||
    lower.includes("developing") ||
    lower.includes("emerging")
  );
}

function linesToRubric(lines, fallbackTitle) {
  const title =
    lines.find((line) => line.length >= 6 && line.length <= 90 && !isLikelyHeading(line)) ||
    fallbackTitle ||
    "Imported Teacher Rubric";

  const levelCount = guessLevelCount(lines);

  const criteriaKeywords = [
    "meaning",
    "style",
    "form",
    "conventions",
    "organization",
    "content",
    "ideas",
    "evidence",
    "analysis",
    "communication",
  ];

  const criteria = [];

  lines.forEach((line, index) => {
    const cleaned = line.replace(/^[-•*\d.)\s]+/, "").trim();
    const lower = cleaned.toLowerCase();

    if (!cleaned) return;
    if (cleaned.length > 140) return;
    if (cleaned.length < 4) return;
    if (lower === title.toLowerCase()) return;
    if (lower.includes("school year")) return;
    if (lower.includes("english")) return;
    if (lower.includes("scoring guide")) return;
    if (lower.includes("first-draft")) return;
    if (lower.includes("assessed as such")) return;
    if (lower.includes("ministry of education")) return;
    if (lower.includes("level")) return;
    if (lower.includes("score")) return;
    if (lower.includes("rubric")) return;
    if (lower.includes("response")) return;
    if (lower.includes("holistically")) return;

    const looksLikeCriterion = criteriaKeywords.some((keyword) => lower.includes(keyword));
    if (!looksLikeCriterion) return;

    if (criteria.some((item) => item.name.toLowerCase() === cleaned.toLowerCase())) return;

    const descriptors = {};
    const nearbyLines = lines.slice(index + 1, index + 9);

    for (let level = 1; level <= levelCount; level += 1) {
      descriptors[`level_${level}`] = nearbyLines[level - 1] || "";
    }

    criteria.push({
      id: `imported-criterion-${Date.now()}-${index}`,
      name: cleaned,
      weight: "",
      descriptors,
    });
  });

  const finalCriteria = criteria.length
    ? criteria.slice(0, 6)
    : [
        {
          id: `imported-criterion-${Date.now()}-fallback`,
          name: "Imported criterion",
          weight: "",
          descriptors: {},
        },
      ];

  return {
    title,
    level_count: levelCount,
    criteria: finalCriteria,
    raw_text: lines.join("\n"),
  };
}

function sheetToRubric(workbook, fallbackTitle) {
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const usableRows = rows
    .map((row) => row.map((cell) => String(cell || "").trim()))
    .filter((row) => row.some(Boolean));

  const title =
    usableRows.flat().find((cell) => cell.length >= 6 && cell.length <= 90) ||
    fallbackTitle ||
    "Imported Excel Rubric";

  const headerRow =
    usableRows.find((row) => row.filter(Boolean).length >= 4) ||
    usableRows[0] ||
    [];

  const possibleLevelCount = Math.min(6, Math.max(4, headerRow.filter(Boolean).length - 1));
  const levelCount = [4, 5, 6].includes(possibleLevelCount) ? possibleLevelCount : 4;

  const criteriaRows = usableRows.filter((row) => {
    const first = String(row[0] || "").trim();
    return first && first.toLowerCase() !== title.toLowerCase() && first.length <= 120;
  });

  const criteria = criteriaRows.slice(0, 12).map((row, index) => {
    const descriptors = {};

    for (let level = 1; level <= levelCount; level += 1) {
      descriptors[`level_${level}`] = row[level] || "";
    }

    return {
      id: `imported-criterion-${Date.now()}-${index}`,
      name: row[0],
      weight: "",
      descriptors,
    };
  });

  return {
    title,
    level_count: levelCount,
    criteria: criteria.length
      ? criteria
      : [
          {
            id: `imported-criterion-${Date.now()}-fallback`,
            name: "Imported criterion",
            weight: "",
            descriptors: {},
          },
        ],
    raw_text: usableRows.map((row) => row.join(" | ")).join("\n"),
  };
}

router.post(
  "/assignments/:assignmentId/teacher-designed-rubric/import",
  upload.single("file"),
  async (req, res) => {
    const assignmentId = Number(req.params.assignmentId);

    if (!Number.isFinite(assignmentId)) {
      return res.status(400).json({ error: "Valid assignment id is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Rubric import file is required" });
    }

    const originalName = req.file.originalname || "";
    const extension = path.extname(originalName).toLowerCase();

    try {
      let converted;

      if (extension === ".docx") {
        const result = await mammoth.extractRawText({ path: req.file.path });
        converted = linesToRubric(splitLines(result.value), originalName.replace(extension, ""));
      } else if (extension === ".pdf") {
        const buffer = fs.readFileSync(req.file.path);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        await parser.destroy();
        converted = linesToRubric(splitLines(result.text), originalName.replace(extension, ""));
      } else if (extension === ".xlsx") {
        const workbook = xlsx.readFile(req.file.path);
        converted = sheetToRubric(workbook, originalName.replace(extension, ""));
      } else {
        return res.status(400).json({
          error: "Unsupported file type. Upload DOCX, PDF, or XLSX.",
        });
      }

      return res.json({
        success: true,
        assignment_id: assignmentId,
        imported: converted,
      });
    } catch (err) {
      console.error("Teacher designed rubric import failed:", err);
      return res.status(500).json({
        error: "Failed to import rubric. Use a text-based DOCX, PDF, or XLSX file.",
      });
    } finally {
      fs.unlink(req.file.path, () => {});
    }
  }
);

module.exports = router;
