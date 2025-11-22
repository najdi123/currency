import { Controller, Get, HttpStatus, HttpException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";

@Controller("health")
export class HealthController {
  constructor(@InjectConnection() private connection: Connection) {}

  @Get()
  async check() {
    const dbStatus = this.connection.readyState === 1 ? "up" : "down";

    return {
      status: dbStatus === "up" ? "ok" : "error",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbStatus,
        name: this.connection.name,
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }

  @Get("ready")
  async readiness() {
    // Check if app is ready to serve traffic
    if (this.connection.readyState !== 1) {
      throw new HttpException(
        "Database not ready",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: "ready" };
  }

  @Get("live")
  async liveness() {
    // Check if app is alive (don't check database)
    return { status: "alive" };
  }
}
