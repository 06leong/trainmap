export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function cleanEncoding(input: string): string {
  return input.replace(/^\uFEFF/, "").replace(/\uFFFD/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function detectDelimiter(input: string): string {
  const firstLine = cleanEncoding(input).split("\n").find((line) => line.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: splitCsvLine(firstLine, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

export function parseCsv(input: string, delimiter = detectDelimiter(input)): ParsedCsv {
  const lines = cleanEncoding(input)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const [headerLine, ...bodyLines] = lines;
  const headers = splitCsvLine(headerLine ?? "", delimiter).map((header) => header.trim());
  const rows = bodyLines.map((line) => {
    const values = splitCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
  });

  return {
    delimiter,
    headers,
    rows
  };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === delimiter && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}
