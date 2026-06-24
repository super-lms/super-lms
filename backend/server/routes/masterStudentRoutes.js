const express = require("express");
const fs = require("fs");
const XLSX = require("xlsx");
const pool = require("../db");

const router = express.Router();

const REQUIRED_COLUMNS = [
  "pen",
  "student_id",
  "legal_first_name",
  "legal_last_name",
  "display_name",
  "current_grade",
  "next_year_grade",
  "school_year",
  "school_code",
  "status",
];

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function cleanString(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function cleanOptionalString(value) {
  const cleaned = cleanString(value);
  return cleaned === "" ? null : cleaned;
}

function cleanInteger(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function isValidPen(value) {
  return /^[0-9]{9}$/.test(cleanString(value));
}

function normalizeStudentRow(rawRow, rowNumber) {
  const row = {};

  for (const key of Object.keys(rawRow)) {
    row[normalizeHeader(key)] = rawRow[key];
  }

  const pen = cleanString(row.pen);
  const legalFirstName = cleanString(row.legal_first_name);
  const legalMiddleName = cleanOptionalString(row.legal_middle_name);
  const legalLastName = cleanString(row.legal_last_name);
  const generatedDisplayName = [legalFirstName, legalMiddleName, legalLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const normalized = {
    pen,
    student_id: cleanOptionalString(row.student_id),
    legal_first_name: legalFirstName,
    legal_middle_name: legalMiddleName,
    legal_last_name: legalLastName,
    display_name: cleanString(row.display_name) || generatedDisplayName,
    gender: cleanOptionalString(row.gender),
    current_grade: cleanInteger(row.current_grade),
    next_year_grade: cleanInteger(row.next_year_grade),
    current_homeform: cleanOptionalString(row.current_homeform),
    next_year_homeform: cleanOptionalString(row.next_year_homeform),
    school_year: cleanString(row.school_year) || "2026-2027",
    school_code: cleanString(row.school_code) || "CBC-WENZHOU",
    student_email: cleanOptionalString(row.student_email),
    parent_email: cleanOptionalString(row.parent_email),
    parent_name: cleanOptionalString(row.parent_name),
    status: cleanString(row.status) || "Active",
    notes: cleanOptionalString(row.notes),
    source_row_number: rowNumber,
  };

  const issues = [];

  if (!isValidPen(normalized.pen)) {
    issues.push("PEN must be exactly 9 digits.");
  }

  if (!normalized.legal_first_name) {
    issues.push("Legal first name is required.");
  }

  if (!normalized.legal_last_name) {
    issues.push("Legal last name is required.");
  }

  if (!normalized.display_name) {
    issues.push("Display name is required.");
  }

  if (!normalized.current_grade) {
    issues.push("Current grade is required.");
  }

  if (!normalized.next_year_grade) {
    issues.push("Next year grade is required.");
  }

  if (!normalized.school_year) {
    issues.push("School year is required.");
  }

  if (!normalized.school_code) {
    issues.push("School code is required.");
  }

  return {
    ...normalized,
    import_status: issues.length === 0 ? "Ready" : "Review",
    import_issues: issues,
  };
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const preferredSheetName = workbook.SheetNames.includes("Master Student Directory")
    ? "Master Student Directory"
    : workbook.SheetNames[0];

  const worksheet = workbook.Sheets[preferredSheetName];

  if (!worksheet) {
    return {
      sheetName: preferredSheetName,
      rows: [],
      missingColumns: REQUIRED_COLUMNS,
    };
  }

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
    raw: false,
  });

  const availableColumns = rawRows.length > 0
    ? Object.keys(rawRows[0]).map(normalizeHeader)
    : [];

  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !availableColumns.includes(column)
  );

  const rows = rawRows
    .map((rawRow, index) => normalizeStudentRow(rawRow, index + 2))
    .filter((row) => row.pen || row.student_id || row.display_name);

  const penCounts = rows.reduce((counts, row) => {
    if (row.pen) {
      counts[row.pen] = (counts[row.pen] || 0) + 1;
    }
    return counts;
  }, {});

  const rowsWithDuplicateCheck = rows.map((row) => {
    const duplicateIssues = [...row.import_issues];

    if (row.pen && penCounts[row.pen] > 1) {
      duplicateIssues.push("Duplicate PEN appears in uploaded file.");
    }

    return {
      ...row,
      import_status: duplicateIssues.length === 0 ? "Ready" : "Review",
      import_issues: duplicateIssues,
    };
  });

  return {
    sheetName: preferredSheetName,
    rows: rowsWithDuplicateCheck,
    missingColumns,
  };
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM master_students
      ORDER BY current_grade ASC NULLS LAST,
               current_homeform ASC NULLS LAST,
               display_name ASC,
               pen ASC
      `
    );

    return res.json({
      success: true,
      count: result.rows.length,
      students: result.rows,
    });
  } catch (err) {
    console.error("GET /api/master-students failed:", err);
    return res.status(500).json({ error: "Failed to load master students" });
  }
});

router.get("/summary", async (req, res) => {
  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM master_students`
    );

    const gradeResult = await pool.query(
      `
      SELECT current_grade, COUNT(*)::int AS count
      FROM master_students
      GROUP BY current_grade
      ORDER BY current_grade ASC NULLS LAST
      `
    );

    const reviewResult = await pool.query(
      `
      SELECT COUNT(*)::int AS review_count
      FROM master_students
      WHERE LOWER(status) = 'review'
      `
    );

    return res.json({
      success: true,
      total: countResult.rows[0]?.total || 0,
      review_count: reviewResult.rows[0]?.review_count || 0,
      by_grade: gradeResult.rows,
    });
  } catch (err) {
    console.error("GET /api/master-students/summary failed:", err);
    return res.status(500).json({ error: "Failed to load master student summary" });
  }
});

router.get("/homeform-summary", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        next_year_grade,
        COALESCE(NULLIF(next_year_homeform, ''), 'Unassigned') AS next_year_homeform,
        COUNT(*)::int AS student_count
      FROM master_students
      WHERE LOWER(COALESCE(status, 'active')) = 'active'
      GROUP BY next_year_grade, COALESCE(NULLIF(next_year_homeform, ''), 'Unassigned')
      ORDER BY next_year_grade ASC NULLS LAST, next_year_homeform ASC
      `
    );

    return res.json({
      success: true,
      groups: result.rows,
    });
  } catch (err) {
    console.error("GET /api/master-students/homeform-summary failed:", err);
    return res.status(500).json({ error: "Failed to load homeform summary" });
  }
});

router.patch("/assign-next-year-homeform", async (req, res) => {
  const studentIds = Array.isArray(req.body?.student_ids) ? req.body.student_ids : [];
  const nextYearHomeform = String(req.body?.next_year_homeform || "").trim().toUpperCase();

  const cleanedStudentIds = studentIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (cleanedStudentIds.length === 0) {
    return res.status(400).json({ error: "At least one valid student id is required." });
  }

  if (!/^(10|11|12)[A-Z]$/.test(nextYearHomeform)) {
    return res.status(400).json({ error: "Next year homeform must look like 10A, 11B, or 12C." });
  }

  try {
    const result = await pool.query(
      `
      UPDATE master_students
      SET next_year_homeform = $1,
          updated_at = NOW()
      WHERE id = ANY($2::int[])
      RETURNING id, display_name, next_year_grade, next_year_homeform
      `,
      [nextYearHomeform, cleanedStudentIds]
    );

    return res.json({
      success: true,
      updated_count: result.rows.length,
      students: result.rows,
    });
  } catch (err) {
    console.error("PATCH /api/master-students/assign-next-year-homeform failed:", err);
    return res.status(500).json({ error: "Failed to assign next year homeform" });
  }
});

router.post("/preview-import", async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Excel file is required." });
    }

    const parsed = parseWorkbook(req.file.path);
    const readyCount = parsed.rows.filter((row) => row.import_status === "Ready").length;
    const reviewCount = parsed.rows.filter((row) => row.import_status === "Review").length;

    fs.unlink(req.file.path, () => {});

    return res.json({
      success: true,
      sheetName: parsed.sheetName,
      rowCount: parsed.rows.length,
      readyCount,
      reviewCount,
      missingColumns: parsed.missingColumns,
      rows: parsed.rows,
    });
  } catch (err) {
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }

    console.error("POST /api/master-students/preview-import failed:", err);
    return res.status(500).json({ error: "Failed to preview master student import" });
  }
});


async function ensureMasterStudentContactColumns() {
  await pool.query(`
    ALTER TABLE master_students
    ADD COLUMN IF NOT EXISTS parent_email TEXT
  `);

  await pool.query(`
    ALTER TABLE master_students
    ADD COLUMN IF NOT EXISTS parent_name TEXT
  `);
}

router.post("/import", async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rows.length === 0) {
    return res.status(400).json({ error: "At least one student row is required." });
  }

  const readyRows = rows
    .map((row, index) => normalizeStudentRow(row, row.source_row_number || index + 2))
    .filter((row) => row.import_status === "Ready");

  if (readyRows.length === 0) {
    return res.status(400).json({ error: "No ready rows found to import." });
  }

  try {
    await ensureMasterStudentContactColumns();

    await pool.query("BEGIN");

    let insertedOrUpdated = 0;

    for (const row of readyRows) {
      await pool.query(
        `
        INSERT INTO master_students (
          pen,
          student_id,
          legal_first_name,
          legal_middle_name,
          legal_last_name,
          display_name,
          gender,
          current_grade,
          next_year_grade,
          current_homeform,
          next_year_homeform,
          school_year,
          school_code,
          student_email,
          parent_email,
          parent_name,
          status,
          notes,
          source_file_name,
          source_row_number,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW()
        )
        ON CONFLICT (pen)
        DO UPDATE
        SET student_id = EXCLUDED.student_id,
            legal_first_name = EXCLUDED.legal_first_name,
            legal_middle_name = EXCLUDED.legal_middle_name,
            legal_last_name = EXCLUDED.legal_last_name,
            display_name = EXCLUDED.display_name,
            gender = EXCLUDED.gender,
            current_grade = EXCLUDED.current_grade,
            next_year_grade = EXCLUDED.next_year_grade,
            current_homeform = EXCLUDED.current_homeform,
            next_year_homeform = EXCLUDED.next_year_homeform,
            school_year = EXCLUDED.school_year,
            school_code = EXCLUDED.school_code,
            student_email = EXCLUDED.student_email,
            parent_email = EXCLUDED.parent_email,
            parent_name = EXCLUDED.parent_name,
            status = EXCLUDED.status,
            notes = EXCLUDED.notes,
            source_file_name = EXCLUDED.source_file_name,
            source_row_number = EXCLUDED.source_row_number,
            updated_at = NOW()
        `,
        [
          row.pen,
          row.student_id,
          row.legal_first_name,
          row.legal_middle_name,
          row.legal_last_name,
          row.display_name,
          row.gender,
          row.current_grade,
          row.next_year_grade,
          row.current_homeform,
          row.next_year_homeform,
          row.school_year,
          row.school_code,
          row.student_email,
          row.parent_email,
          row.parent_name,
          row.status,
          row.notes,
          "dashboard-import",
          row.source_row_number,
        ]
      );

      insertedOrUpdated += 1;
    }

    await pool.query("COMMIT");

    return res.json({
      success: true,
      importedCount: insertedOrUpdated,
      skippedCount: rows.length - readyRows.length,
    });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => {});
    console.error("POST /api/master-students/import failed:", err);
    return res.status(500).json({ error: "Failed to import master students" });
  }
});

module.exports = router;
