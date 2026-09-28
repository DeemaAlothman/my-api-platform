import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

// الفاتورة تُولَّد فقط من عرض مقبول (ACCEPTED) — لا يوجد إنشاء يدوي مباشر
export class CreateSalesInvoiceFromQuotationDto {
  @IsString() @IsNotEmpty() quotationId: string;
  @IsOptional() @IsString() paymentMethod?: string;
  @IsOptional() @IsString() paymentTerms?: string;
}
