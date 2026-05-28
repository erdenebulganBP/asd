import { IsString, IsOptional, IsObject } from 'class-validator';

export class NotificationPayloadDto {
  @IsString()
  fcmToken: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
