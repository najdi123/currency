import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CurrenciesModule } from './currencies/currencies.module';
import { DigitalCurrenciesModule } from './digital-currencies/digital-currencies.module';
import { GoldModule } from './gold/gold.module';
import { NavasanModule } from './navasan/navasan.module';
import { ChartModule } from './chart/chart.module';

@Module({
  imports: [
    // Environment variables configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('MongoDBConnection');
        const uri = configService.get<string>('MONGODB_URI');

        logger.log(`Attempting to connect to MongoDB...`);
        logger.log(`Connection URI: ${uri?.replace(/\/\/.*:.*@/, '//<credentials>@')}`);

        return {
          uri,
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

    // Feature modules
    CurrenciesModule,
    DigitalCurrenciesModule,
    GoldModule,
    NavasanModule,
    ChartModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
