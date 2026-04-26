export interface ParsedCsv {
  delimiter: string;
  headers: string[];
  rows: Array<Record<string, string>>;
  errors: CsvParseError[];
}

export interface CsvParseError {
  rowNumber: number;
  message: string;
}

export function cleanEncoding(input: string): string {
  return input.replace(/^\uFEFF/, "").replace(/\uFFFD/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function detectDelimiter(input: string): string {
  const firstLine = cleanEncoding(input).split("\n").find((line) => line.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: splitCsvLine(firstLine, delimiter).values.length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

export function parseCsv(input: string, delimiter = detectDelimiter(input)): ParsedCsv {
  const lines = cleanEncoding(input)
    .split("\n")
    .filter((line) => line.trim().length > 0);
  const [headerLine, ...bodyLines] = lines;
  const headerParse = splitCsvLine(headerLine ?? "", delimiter);
  const headers = headerParse.values.map((header) => header.trim());
  const errors: CsvParseError[] = headerParse.malformed ? [{ rowNumber: 1, message: "Malformed header row." }] : [];
  const rows = bodyLines.map((line, index) => {
    const rowNumber = index + 2;
    const parsed = splitCsvLine(line, delimiter);
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, parsed.values[valueIndex]?.trim() ?? ""]));

    row.__raw_line = line;
    if (parsed.values.length > headers.length) {
      row.__extra_columns = parsed.values.slice(headers.length).join(delimiter);
      errors.push({ rowNumber, message: `Row has ${parsed.values.length} columns but expected ${headers.length}.` });
    }
    if (parsed.values.length < headers.length) {
      row.__missing_columns = String(headers.length - parsed.values.length);
      errors.push({ rowNumber, message: `Row has ${parsed.values.length} columns but expected ${headers.length}.` });
    }
    if (parsed.malformed) {
      row.__malformed = "true";
      errors.push({ rowNumber, message: "Malformed quoted CSV row." });
    }
    return row;
  });

  return {
    delimiter,
    headers,
    rows,
    errors
  };
}

function splitCsvLine(line: string, delimiter: string): { values: string[]; malformed: boolean } {
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
  return { values, malformed: inQuotes };
}
