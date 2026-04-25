import { Response } from 'express';
import * as ExcelJS from 'exceljs';

export async function sendExcel(
  res: Response,
  filename: string,
  headers: string[],
  rows: (string | number | Date | null | undefined)[][],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report', {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((col) => {
    col.width = 20;
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}.xlsx"`,
  );

  await workbook.xlsx.write(res as any);
  res.end();
}
