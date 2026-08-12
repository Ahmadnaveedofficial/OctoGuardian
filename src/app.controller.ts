import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get('/1')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get()
  getConfig() {
    return {
      environment: this.configService.get<string>('NODE_ENV'),
      port: this.configService.get<number>('PORT'),
    };
  }
}
