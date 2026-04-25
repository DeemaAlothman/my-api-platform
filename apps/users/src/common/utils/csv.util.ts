import { Response } from 'express';

export function toCsvRow(
  values: (string | number | Date | null | undefined)[],
): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) return '';
      const str = String(v);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    })
    .join(',');
}

export function sendCsv(
  res: Response,
  filename: string,
  headers: string[],
  rows: (string | number | Date | null | undefined)[][],
): void {
  const lines = [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
  // BOM for Excel Arabic support
  const bom = '\uFEFF';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}.csv"`,
  );
  res.send(bom + lines);
}
