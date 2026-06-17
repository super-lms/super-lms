// ===== SCORE HELPERS =====
export function normalizeScoreValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

export function toNumberOrNull(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatScoreDisplay(value) {
  const parsed = toNumberOrNull(value);

  if (parsed === null) {
    return "Not graded";
  }

  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2);
}

// ===== DATE / HISTORY =====
export function formatHistoryTimestamp(value) {
  if (!value) return "Recently saved";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Recently saved";
  }

  return parsedDate.toLocaleString();
}

// ===== SUBMISSION HELPERS =====
export function isRowGraded(row) {
  return row.score !== "" && row.score !== null && row.score !== undefined;
}

export function hasSubmissionContent(row) {
  return String(row?.content || "").trim() !== "";
}

export function hasSubmissionFiles(row) {
  return Array.isArray(row?.files) && row.files.length > 0;
}

export function getSubmissionStatusLabel(row) {
  return hasSubmissionContent(row) || hasSubmissionFiles(row)
    ? "Submitted"
    : "No submission";
}

// ===== UTIL =====
export function getEmailKey(studentEmail) {
  return String(studentEmail || "").trim().toLowerCase();
}

export function buildOriginalRowMap(inputRows) {
  const nextMap = {};

  inputRows.forEach((row) => {
    const emailKey = getEmailKey(row.student_email);

    nextMap[emailKey] = {
      score: normalizeScoreValue(row.score),
      feedback: row.feedback || "",
    };
  });

  return nextMap;
}

export function isInteractiveElement(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, button, a, label"));
}

// ===== RUBRIC =====
export function buildEmptyRubricSelection(template) {
  return template.reduce((acc, criterion) => {
    acc[criterion.id] = "";
    return acc;
  }, {});
}

export function calculateRubricTotal(selection, template) {
  if (!selection) return "";

  let total = 0;
  let hasAnySelection = false;

  template.forEach((criterion) => {
    const selectedLevelId = selection[criterion.id];
    if (!selectedLevelId) return;

    const matchedLevel =
      criterion.levels.find((level) => level.id === selectedLevelId) || null;

    if (!matchedLevel) return;

    total += Number(matchedLevel.points || 0);
    hasAnySelection = true;
  });

  return hasAnySelection ? String(total) : "";
}

export function countSelectedRubricCriteria(selection, template) {
  if (!selection) return 0;

  return template.reduce((count, criterion) => {
    return selection[criterion.id] ? count + 1 : count;
  }, 0);
}

// ===== FEEDBACK =====
export function appendFeedbackText(existingFeedback, nextText) {
  const existingValue = String(existingFeedback || "").trim();
  const nextValue = String(nextText || "").trim();

  if (!nextValue) return existingValue;
  if (!existingValue) return nextValue;

  return `${existingValue}\n${nextValue}`;
}

// ===== FILTERING =====
export function applyCurrentFiltersAndSearch(
  inputRows,
  showUngradedOnly,
  showSubmittedOnly,
  showGradedOnly,
  studentSearchText
) {
  const searchValue = String(studentSearchText || "").trim().toLowerCase();

  return inputRows.filter((row) => {
    if (showGradedOnly && !isRowGraded(row)) return false;
    if (showUngradedOnly && isRowGraded(row)) return false;

    if (
      showSubmittedOnly &&
      !hasSubmissionContent(row) &&
      !hasSubmissionFiles(row)
    ) {
      return false;
    }

    if (!searchValue) return true;

    const studentName = String(row.student_name || "").toLowerCase();
    const studentEmail = String(row.student_email || "").toLowerCase();

    return (
      studentName.includes(searchValue) ||
      studentEmail.includes(searchValue)
    );
  });
}

// ===== LOCAL STORAGE =====
export function readStudentGradeHistoryFromStorage(key) {
  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) return {};

    const parsedValue = JSON.parse(rawValue);
    return parsedValue && typeof parsedValue === "object"
      ? parsedValue
      : {};
  } catch {
    return {};
  }
}

export function writeStudentGradeHistoryToStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

// ===== TREND =====
export function buildTrendLabel(historyItems) {
  if (!Array.isArray(historyItems) || historyItems.length < 2) {
    return "Not enough history";
  }

  const latestScore = toNumberOrNull(historyItems[0]?.score);
  const previousScore = toNumberOrNull(historyItems[1]?.score);

  if (latestScore === null || previousScore === null) {
    return "Not enough history";
  }

  if (latestScore > previousScore) return "Improving ↑";
  if (latestScore < previousScore) return "Dropping ↓";

  return "Stable →";
}
