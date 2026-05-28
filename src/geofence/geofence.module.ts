import { Module } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { StoresModule } from '../stores/stores.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [StoresModule, RecommendationsModule, NotificationsModule],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}
