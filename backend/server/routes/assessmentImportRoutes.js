const express = require("express");
const multer = require("multer");
const path = require("path");
const mammoth = require("mammoth");
const { PDFParse } = require("pdf-parse");
const xlsx = require("xlsx");
const pool = require("../db");
const { authenticateJWT, requireRole } = require("../../middleware/auth");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});
const QUESTION_TYPES = new Set([
  "multiple_choice",
  "true_false",
  "short_answer",
  "essay",
]);

function cleanText(value) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function parseId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeType(value) {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    mc: "multiple_choice",
    multiplechoice: "multiple_choice",
    multiple_choice: "multiple_choice",
    tf: "true_false",
    truefalse: "true_false",
    true_false: "true_false",
    short: "short_answer",
    shortanswer: "short_answer",
    short_answer: "short_answer",
    written: "essay",
    long_answer: "essay",
    essay: "essay",
  };
  return aliases[normalized] || normalized;
}

function normalizeOptions(values) {
  return values.map(cleanText).filter(Boolean);
}

function reviewQuestion(question, index) {
  const type = normalizeType(question.question_type);
  const prompt = cleanText(question.prompt);
  const options =
    type === "true_false"
      ? ["True", "False"]
      : normalizeOptions(Array.isArray(question.options) ? question.options : []);
  let correctAnswer = cleanText(question.correct_answer);
  const issues = [];

  if (!QUESTION_TYPES.has(type)) issues.push("Choose a supported question type.");
  if (!prompt) issues.push("Question text is missing.");
  if (type === "multiple_choice" && options.length < 2) {
    issues.push("Add at least two answer choices.");
  }

  if (/^[A-Z]$/i.test(correctAnswer) && options.length) {
    const optionIndex = correctAnswer.toUpperCase().charCodeAt(0) - 65;
    correctAnswer = options[optionIndex] || "";
  }

  if (["multiple_choice", "true_false"].includes(type) && !correctAnswer) {
    issues.push("Select the correct answer.");
  }
  if (type === "multiple_choice" && correctAnswer && !options.includes(correctAnswer)) {
    issues.push("Correct answer must match one answer choice.");
  }
  if (
    type === "true_false" &&
    correctAnswer &&
    !["true", "false"].includes(correctAnswer.toLowerCase())
  ) {
    issues.push("Correct answer must be True or False.");
  }

  const points = Number(question.points);
  if (!(points > 0)) issues.push("Points must be greater than zero.");

  return {
    import_id: `import-question-${index + 1}`,
    question_type: QUESTION_TYPES.has(type) ? type : "multiple_choice",
    prompt,
    options,
    correct_answer:
      type === "true_false" && correctAnswer
        ? correctAnswer[0].toUpperCase() + correctAnswer.slice(1).toLowerCase()
        : correctAnswer,
    points: points > 0 ? points : 1,
    teacher_feedback: cleanText(question.teacher_feedback),
    status: issues.length ? "flagged" : "accepted",
    issues,
  };
}

function parseSpreadsheet(buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });
  const key = (row, names) => {
    const entry = Object.entries(row).find(([heading]) =>
      names.includes(cleanText(heading).toLowerCase().replace(/[\s-]+/g, "_"))
    );
    return entry ? entry[1] : "";
  };

  return rows.map((row) => ({
    question_type: key(row, ["question_type", "type"]),
    prompt: key(row, ["question", "prompt", "question_text"]),
    options: [
      key(row, ["choice_a", "option_a", "answer_a"]),
      key(row, ["choice_b", "option_b", "answer_b"]),
      key(row, ["choice_c", "option_c", "answer_c"]),
      key(row, ["choice_d", "option_d", "answer_d"]),
      key(row, ["choice_e", "option_e", "answer_e"]),
    ],
    correct_answer: key(row, ["correct_answer", "answer", "key"]),
    points: key(row, ["points", "point_value"]) || 1,
    teacher_feedback: key(row, ["feedback", "teacher_feedback"]),
  }));
}

function parseStructuredText(text) {
  const lines = cleanText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const questions = [];
  let current = null;
  let lastField = "prompt";

  function finishCurrent() {
    if (current?.prompt) questions.push(current);
    current = null;
    lastField = "prompt";
  }

  lines.forEach((line) => {
    const questionMatch = line.match(/^(?:question\s*)?(\d+)[.)]\s*(.*)$/i);
    const metadataMatch = line.match(
      /^(type|answer|correct answer|points?|feedback)\s*:\s*(.*)$/i
    );

    if (questionMatch) {
      finishCurrent();
      current = {
        question_type: "",
        prompt: questionMatch[2],
        options: [],
        correct_answer: "",
        points: 1,
        teacher_feedback: "",
      };
      lastField = "prompt";
      return;
    }
    if (!current) return;

    if (/^[A-E][.)]\s+/i.test(line)) {
      const matches = [...line.matchAll(/(?:^|\s+)([A-E])[.)]\s+/gi)];
      if (matches.length) {
        matches.forEach((match, matchIndex) => {
          const valueStart = match.index + match[0].length;
          const valueEnd =
            matchIndex + 1 < matches.length ? matches[matchIndex + 1].index : line.length;
          const optionText = line.slice(valueStart, valueEnd).trim();
          if (optionText) current.options.push(optionText);
        });
        lastField = "option";
      }
      return;
    }
    if (metadataMatch) {
      const label = metadataMatch[1].toLowerCase();
      const value = metadataMatch[2];
      if (label === "type") current.question_type = value;
      if (label === "answer" || label === "correct answer") {
        current.correct_answer = value;
      }
      if (label.startsWith("point")) current.points = value;
      if (label === "feedback") current.teacher_feedback = value;
      lastField = "metadata";
      return;
    }
    if (lastField === "option" && current.options.length) {
      current.options[current.options.length - 1] =
        `${current.options[current.options.length - 1]} ${line}`.trim();
    } else {
      current.prompt = `${current.prompt}\n${line}`.trim();
      lastField = "prompt";
    }
  });
  finishCurrent();

  return questions.map((question) => ({
    ...question,
    question_type:
      question.question_type ||
      (question.options.length ? "multiple_choice" : "essay"),
  }));
}

async function canManageCourse(user, courseId) {
  if (String(user?.role || "").toLowerCase() === "admin") return true;
  const userId = parseId(user?.id);
  if (!userId) return false;
  const result = await pool.query(
    `
    SELECT 1
    FROM courses c
    LEFT JOIN course_teachers ct
      ON ct.course_id = c.id AND ct.teacher_id = $2
    WHERE c.id = $1 AND (c.teacher_id = $2 OR ct.teacher_id = $2)
    LIMIT 1
    `,
    [courseId, userId]
  );
  return result.rows.length > 0;
}

router.get(
  "/assessment-imports/template.xlsx",
  authenticateJWT,
  requireRole("admin", "teacher"),
  (req, res) => {
    const rows = [
      {
        question_type: "multiple_choice",
        question: "What is 2 + 2?",
        choice_a: "3",
        choice_b: "4",
        choice_c: "5",
        choice_d: "",
        correct_answer: "B",
        points: 1,
        feedback: "Two plus two equals four.",
      },
      {
        question_type: "essay",
        question: "Explain how you determined your answer.",
        choice_a: "",
        choice_b: "",
        choice_c: "",
        choice_d: "",
        correct_answer: "",
        points: 2,
        feedback: "",
      },
    ];
    const workbook = xlsx.utils.book_new();
    const sheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, "Assessment Questions");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="SUPER_LMS_Assessment_Import_Template.xlsx"'
    );
    return res.send(buffer);
  }
);

router.post(
  "/assessment-imports/preview",
  authenticateJWT,
  requireRole("admin", "teacher"),
  upload.single("file"),
  async (req, res) => {
    const courseId = parseId(req.body.course_id);
    if (!courseId) return res.status(400).json({ error: "Select a course first." });
    if (!(await canManageCourse(req.user, courseId))) {
      return res.status(403).json({ error: "You cannot manage this course." });
    }
    if (!req.file) return res.status(400).json({ error: "Choose a file to import." });

    const extension = path.extname(req.file.originalname || "").toLowerCase();
    try {
      let parsedQuestions = [];
      let sourceType = "";
      if ([".xlsx", ".xls"].includes(extension)) {
        sourceType = "spreadsheet";
        parsedQuestions = parseSpreadsheet(req.file.buffer);
      } else if (extension === ".docx") {
        sourceType = "word";
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        parsedQuestions = parseStructuredText(result.value);
      } else if (extension === ".pdf") {
        sourceType = "pdf";
        const parser = new PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        await parser.destroy();
        parsedQuestions = parseStructuredText(result.text);
      } else {
        return res.status(400).json({
          error: "Unsupported file type. Upload XLSX, XLS, DOCX, or text-based PDF.",
        });
      }

      const questions = parsedQuestions.map(reviewQuestion);
      const accepted = questions.filter((question) => question.status === "accepted").length;
      const flagged = questions.length - accepted;
      const title = path.basename(req.file.originalname, extension);

      return res.json({
        source: {
          file_name: req.file.originalname,
          source_type: sourceType,
        },
        title,
        instructions: "",
        questions,
        report: {
          found: questions.length,
          accepted,
          flagged,
        },
        warnings: questions.length
          ? []
          : [
              "No structured questions were found. Use the SUPER LMS import template or add numbered questions with labelled answers.",
            ],
      });
    } catch (error) {
      console.error("POST /api/assessment-imports/preview failed:", error);
      return res.status(400).json({
        error: "The file could not be read as a structured assessment.",
      });
    }
  }
);

router.post(
  "/assessment-imports/create-draft",
  authenticateJWT,
  requireRole("admin", "teacher"),
  async (req, res) => {
    const courseId = parseId(req.body.course_id);
    const title = cleanText(req.body.title);
    const questions = Array.isArray(req.body.questions)
      ? req.body.questions.map(reviewQuestion)
      : [];

    if (!courseId || !title) {
      return res.status(400).json({ error: "Course and assessment title are required." });
    }
    if (!(await canManageCourse(req.user, courseId))) {
      return res.status(403).json({ error: "You cannot manage this course." });
    }
    if (!questions.length) {
      return res.status(400).json({ error: "At least one reviewed question is required." });
    }
    const flagged = questions.filter((question) => question.status === "flagged");
    if (flagged.length) {
      return res.status(400).json({
        error: `Resolve ${flagged.length} flagged question${flagged.length === 1 ? "" : "s"} before creating the draft.`,
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const teacherId =
        String(req.user.role).toLowerCase() === "admin"
          ? parseId(req.body.teacher_id) || parseId(req.user.id)
          : parseId(req.user.id);
      const assessmentResult = await client.query(
        `
        INSERT INTO assessments (
          course_id, teacher_id, title, instructions, status
        )
        VALUES ($1,$2,$3,$4,'draft')
        RETURNING *
        `,
        [courseId, teacherId, title, cleanText(req.body.instructions)]
      );
      const assessment = assessmentResult.rows[0];

      for (let index = 0; index < questions.length; index += 1) {
        const question = questions[index];
        await client.query(
          `
          INSERT INTO assessment_questions (
            assessment_id, question_type, prompt, options_json,
            correct_answer_json, points, teacher_feedback, sort_order
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `,
          [
            assessment.id,
            question.question_type,
            question.prompt,
            JSON.stringify(question.options),
            JSON.stringify(question.correct_answer),
            question.points,
            question.teacher_feedback,
            index + 1,
          ]
        );
      }

      await client.query("COMMIT");
      return res.status(201).json({
        ...assessment,
        imported_question_count: questions.length,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("POST /api/assessment-imports/create-draft failed:", error);
      return res.status(500).json({ error: "Failed to create imported assessment draft." });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
