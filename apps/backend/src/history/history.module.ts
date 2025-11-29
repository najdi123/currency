import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HistoryService } from "./history.service";
import { ChartModule } from "../chart/chart.module";
import {
  OHLCPermanent,
  OHLCPermanentSchema,
} from "../market-data/schemas/ohlc-permanent.schema";

@Module({
  imports: [
    ChartModule,
    MongooseModule.forFeature([
      { name: OHLCPermanent.name, schema: OHLCPermanentSchema },
    ]),
  ],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
