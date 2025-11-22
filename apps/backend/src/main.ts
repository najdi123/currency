import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: Add Helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API-only service
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Trust proxy headers for accurate IP address extraction
  // This is necessary when deployed behind a reverse proxy (nginx, AWS ALB, etc.)
  const expressApp = app.getHttpAdapter().getInstance();
  const isProduction = process.env.NODE_ENV === "production";

  // Only trust proxy in production to avoid rate limiting issues in development
  if (isProduction) {
    expressApp.set("trust proxy", 1); // Trust first proxy
  }

  // Security: Add general rate limiting (ONLY in production)
  // This is a high-level protection against abuse, not fresh data rate limiting
  // Fresh data rate limiting is handled by RateLimitGuard (20 req per 2-hour window)
  if (isProduction) {
    console.log(
      "🛡️  General rate limiting ENABLED (Production): 1000 req/15min",
    );
    app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 1000, // Increased from 100 to 1000 to allow stale data requests
        message: "Too many requests from this IP, please try again later.",
        standardHeaders: true,
        legacyHeaders: false,
        skipFailedRequests: false,
        skipSuccessfulRequests: false,
      }),
    );
  } else {
    console.log("🔓 General rate limiting DISABLED (Development)");
  }

  // Enable CORS for frontend integration
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(",").map((url) => url.trim()) || [
      "http://localhost:3000",
    ],
    credentials: true,
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Set global prefix for all routes
  app.setGlobalPrefix("api");

  // Configure Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle("Currency API")
    .setDescription(
      "Currency tracking and authentication API with admin user management",
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT-auth", // This name will be used in @ApiBearerAuth() decorator
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
  console.log(
    `Swagger documentation available at: http://localhost:${port}/api/docs`,
  );

  // Graceful shutdown handling
  const signals = ["SIGTERM", "SIGINT"];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop accepting new requests and close existing connections
        await app.close();
        console.log("Application shut down gracefully");
        process.exit(0);
      } catch (error) {
        console.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  });
}
bootstrap();
