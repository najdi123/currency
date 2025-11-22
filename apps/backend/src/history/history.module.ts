import { Module } from "@nestjs/common";
import { HistoryService } from "./history.service";
import { ChartModule } from "../chart/chart.module";

@Module({
  imports: [ChartModule],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
