import { NotificationSink, SubscriberRepository } from './ports';
import { Notification, ResourceId } from './data-model';
import { DialectSdk, IllegalStateError } from '@dialectlabs/sdk';

export interface DialectCloudNotification extends Notification {
  title: string;
  message: string;
  dispatchType: 'unicast' | 'multicast' | 'broadcast';
}

export class DialectCloudNotificationSink
  implements NotificationSink<DialectCloudNotification>
{
  constructor(
    private readonly sdk: DialectSdk,
  ) {}

  async push({ title, message, dispatchType }: DialectCloudNotification, recipients: ResourceId[]) {
    const dapp = await this.sdk.dapps.find();
    if (!dapp) {
      throw new IllegalStateError(
        "Dapp doesn't exist in Dialect Cloud, please create dapp in Dialect Cloud to use cloud notification sink.",
      );
    }
    
    if (dispatchType === 'unicast') {
      await dapp.messages.send({
        title: title,
        message: message,
        recipient: recipients[0],
      });
    } else if (dispatchType === 'multicast') {
      await dapp.messages.send({
        title: title,
        message: message,
        recipients: recipients,
      });
    } else if (dispatchType === 'broadcast') {
      await dapp.messages.send({
        title: title,
        message: message,
      });
    } else {
      throw new IllegalStateError(
        `Dialect Cloud notification sink does not support this dispatch type: ${dispatchType}.`,
      );
    }

    return;
  }
}
