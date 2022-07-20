import { NotificationSink } from './ports';
import { Notification, ResourceId } from './data-model';
import { DialectSdk, IllegalStateError } from '@dialectlabs/sdk';
import { DispatchType } from './monitor-builder';

export interface DialectSdkNotification extends Notification {
  title: string;
  message: string;
}

// TODO update name: DialectSdkNotificationSink
export class DialectSdkNotificationSink
  implements NotificationSink<DialectSdkNotification>
{
  constructor(private readonly sdk: DialectSdk) {}

  async push(
    { title, message }: DialectSdkNotification,
    recipients: ResourceId[],
    dispatchType: DispatchType,
  ) {
    // TODO: add error handling
    const dapp = await this.sdk.dapps.find();
    if (!dapp) {
      throw new IllegalStateError(
        "Dapp doesn't exist in Dialect Cloud, please create dapp in Dialect Cloud to use SDK notification sink.",
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
        `Dialect SDK notification sink does not support this dispatch type: ${dispatchType}.`,
      );
    }
    return;
  }
}
