import { Module, Global } from "@nestjs/common";
import { AuditService } from "./services/audit.service";
import { EmailService } from "./services/email.service";
import { CurrencyConversionService } from "./services/currency-conversion.service";

@Global()
@Module({
  providers: [AuditService, EmailService, CurrencyConversionService],
  exports: [AuditService, EmailService, CurrencyConversionService],
})
export class CommonModule {}
