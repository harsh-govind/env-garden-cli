import type { TableRow } from "../types/manage.js";

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Prints rows as left-aligned columns; the first row is the header. */
export function printTable(rows: TableRow[]) {
  const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => (row[column] ?? "").length))) ?? [];

  rows.forEach((row, index) => {
    console.log(row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join("  ").trimEnd());

    if (index === 0) {
      console.log(widths.map((width) => "-".repeat(width)).join("  "));
    }
  });
}
