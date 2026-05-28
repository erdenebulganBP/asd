import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationPayloadDto } from './dto/notification-payload.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // POST /notifications/send
  @Post('send')
  send(@Body() payload: NotificationPayloadDto) {
    return this.notificationsService.send(payload);
  }
}
