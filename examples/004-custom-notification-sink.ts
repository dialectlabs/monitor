import { Notification, NotificationSink, ResourceId } from '../src';

// Custom notification sink implementing the NotificationSink interface
export class ConsoleNotificationSink<N extends Notification>
  implements NotificationSink<N>
{
  // Define logic for to push notifications
  push(notification: N, recipients: ResourceId[]): Promise<void> {
    // In this case, notifications sent to the console log
    console.log(
      `Got new notification ${JSON.stringify(
        notification,
      )} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
