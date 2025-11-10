import { Module, Logger, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrenciesModule } from './currencies/currencies.module';
import { DigitalCurrenciesModule } from './digital-currencies/digital-currencies.module';
import { GoldModule } from './gold/gold.module';
import { NavasanModule } from './navasan/navasan.module';
import { ChartModule } from './chart/chart.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { WalletsModule } from './wallets/wallets.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { OHLCModule } from './ohlc/ohlc.module';

@Module({
  imports: [
    // Environment variables configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection with production-ready configuration
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongoDBConnection');
        const uri = configService.get<string>('MONGODB_URI');

        logger.log(`Attempting to connect to MongoDB...`);

        // Better sanitization using URL parsing
        const sanitizeMongoUri = (uri: string): string => {
          try {
            const url = new URL(uri);
            return `${url.protocol}//<credentials>@${url.host}${url.pathname}`;
          } catch {
            return '<invalid-uri>';
          }
        };

        // Only log in development
        if (process.env.NODE_ENV !== 'production' && uri) {
          logger.log(`Connection URI: ${sanitizeMongoUri(uri)}`);
        }

        return {
          uri,
          // Production-ready connection pool configuration
          maxPoolSize: 10, // Maximum 10 connections
          minPoolSize: 2,  // Keep 2 connections always ready
          serverSelectionTimeoutMS: 5000, // Fail fast if MongoDB is down
          socketTimeoutMS: 45000, // Close idle sockets after 45s
          family: 4, // Use IPv4, avoid DNS lookup delays
          retryWrites: true, // Retry failed writes once
          retryReads: true,  // Retry failed reads once
          connectTimeoutMS: 10000, // 10s connection timeout
          connectionFactory: (connection) => {
            connection.on('connected', () => {
              logger.log('✅ MongoDB connection established successfully');
              logger.log(`Database: ${connection.name}`);
            });

            connection.on('disconnected', () => {
              logger.warn('⚠️  MongoDB disconnected');
            });

            connection.on('error', (error: Error) => {
              logger.error(`❌ MongoDB connection error: ${error.message}`);
            });

            return connection;
          },
        };
      },
      inject: [ConfigService],
    }),

    // Throttler for rate limiting
    // NOTE: This is a backup rate limiter. Primary rate limiting is in main.ts
    // In development: Very high limit (10000/min = essentially unlimited)
    // In production: Reasonable limit (500/min)
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        // limit: process.env.NODE_ENV === 'production' ? 500 : 10000, // 10k/min in dev, 500/min in prod
        limit: process.env.NODE_ENV === 'production' ? 5000 : 10000, // temporarily for demo i will increase this, for actual users we have to discuss this
      },
    ]),

    // Global modules
    MetricsModule, // Global module for metrics tracking
    CommonModule, // Global module for common services (audit, etc.)

    // Feature modules
    CurrenciesModule,
    DigitalCurrenciesModule,
    GoldModule,
    NavasanModule,
    ChartModule,
    HealthModule,
     WalletsModule,
     AuthModule,
     SchedulerModule,
     OHLCModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
