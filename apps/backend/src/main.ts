import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Add Helmet for security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for API-only service
    crossOriginEmbedderPolicy: false,
  }));

  // Security: Add rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  // Enable CORS for frontend integration
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',').map((url) => url.trim()) || ['http://localhost:3000'],
    credentials: true,
  });

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);

  // Graceful shutdown handling
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new requests and close existing connections
        await app.close();
        console.log('Application shut down gracefully');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });
  });
}
bootstrap();
