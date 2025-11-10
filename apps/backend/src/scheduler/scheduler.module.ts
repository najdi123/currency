import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NavasanSchedulerService } from './navasan-scheduler.service';
import { OhlcCleanupSchedulerService } from './ohlc-cleanup-scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { NavasanModule } from '../navasan/navasan.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron functionality
    NavasanModule, // Import to use NavasanService and OhlcSnapshot model
  ],
  controllers: [SchedulerController],
  providers: [NavasanSchedulerService, OhlcCleanupSchedulerService],
  exports: [NavasanSchedulerService, OhlcCleanupSchedulerService], // Export for potential use in other modules
})
export class SchedulerModule {}
