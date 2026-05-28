import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NotificationPayload {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: any = null;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    await this.initFirebase();
  }

  private async initFirebase() {
    const projectId = this.config.get('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn(
        '⚠️  Firebase credentials not configured. Notifications will be logged only. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env',
      );
      return;
    }

    try {
      const admin = await import('firebase-admin');

      // Avoid double init in watch mode
      if (admin.default.apps.length > 0) {
        this.firebaseApp = admin.default.apps[0];
        return;
      }

      this.firebaseApp = admin.default.initializeApp({
        credential: admin.default.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });

      this.logger.log('✅ Firebase initialized');
    } catch (err) {
      this.logger.error(`Firebase init failed: ${err.message}`);
    }
  }

  async send(payload: NotificationPayload): Promise<{ success: boolean; messageId?: string }> {
    if (!payload.fcmToken) {
      this.logger.warn('FCM token is missing — skipping notification');
      return { success: false };
    }

    this.logger.log(
      `📲 Notification → "${payload.title}" | "${payload.body}" | token: ${payload.fcmToken.slice(0, 20)}...`,
    );

    if (!this.firebaseApp) {
      this.logger.warn('Firebase not configured — notification logged only (mock mode)');
      return { success: true, messageId: `mock_${Date.now()}` };
    }

    try {
      const admin = await import('firebase-admin');
      const messaging = admin.default.messaging(this.firebaseApp);

      const messageId = await messaging.send({
        token: payload.fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      });

      this.logger.log(`✅ FCM sent: ${messageId}`);
      return { success: true, messageId };
    } catch (err) {
      this.logger.error(`FCM send failed: ${err.message}`);
      return { success: false };
    }
  }

  async sendBulk(payloads: NotificationPayload[]) {
    return Promise.all(payloads.map((p) => this.send(p)));
  }
}
