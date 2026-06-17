export function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "Not calculated";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return "Not calculated";
  }

  return `${numericValue.toFixed(2)}%`;
}

export function formatDate(value) {
  if (!value) {
    return "No due date";
  }

  return String(value).slice(0, 10);
}
