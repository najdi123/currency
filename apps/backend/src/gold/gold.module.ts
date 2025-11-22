import { Module } from "@nestjs/common";
import { GoldService } from "./gold.service";
import { GoldController } from "./gold.controller";
import { HistoryModule } from "../history/history.module";

@Module({
  imports: [HistoryModule],
  controllers: [GoldController],
  providers: [GoldService],
  exports: [GoldService],
})
export class GoldModule {}
