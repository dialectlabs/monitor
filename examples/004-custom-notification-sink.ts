import { Notification, NotificationSink, ResourceId } from '../src';

export class ConsoleNotificationSink implements NotificationSink {
  push(notification: Notification, recipients: ResourceId[]): Promise<void> {
    console.log(
      `Got new notification ${JSON.stringify(
        notification,
      )} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
