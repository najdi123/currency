import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "Welcome to Currency Tracker API - All prices are in Iranian Toman (IRR)";
  }
}
