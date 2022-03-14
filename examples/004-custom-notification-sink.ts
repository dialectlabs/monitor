import { NotificationSink, ResourceId } from '../src';

export class ConsoleNotificationSink<R> implements NotificationSink<R> {
  push(data: R, recipients: ResourceId[]): Promise<void> {
    console.log(
      `Got new notification ${JSON.stringify(
        data,
      )} for recipients ${recipients}`,
    );
    return Promise.resolve();
  }
}
