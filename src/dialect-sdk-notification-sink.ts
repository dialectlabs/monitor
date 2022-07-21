import { NotificationSink, NotificationSinkMetadata } from './ports';
import { Notification, ResourceId } from './data-model';
import { Dapp, DialectSdk, IllegalStateError } from '@dialectlabs/sdk';

export interface DialectSdkNotification extends Notification {
  title: string;
  message: string;
}

export class DialectSdkNotificationSink
  implements NotificationSink<DialectSdkNotification>
{
  private dapp: Dapp | null = null;

  constructor(private readonly sdk: DialectSdk) {}

  async push(
    { title, message }: DialectSdkNotification,
    recipients: ResourceId[],
    { dispatchType }: NotificationSinkMetadata,
  ) {
    try {
      const dapp = await this.lookupDapp();
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
        console.error(
          `Dialect SDK notification sink does not support this dispatch type: ${dispatchType}.`,
        );
      }
    } catch (e) {
      console.error(`Failed to send dialect sdk notification ${e}`);
    }
    return;
  }

  private async lookupDapp() {
    if (!this.dapp) {
      const dapp = await this.sdk.dapps.find();
      if (!dapp) {
        throw new IllegalStateError(
          `Dapp ${this.sdk.info.wallet.publicKey?.toBase58()} not registered in dialect cloud ${
            this.sdk.info.config.dialectCloud.url
          }`,
        );
      }
      this.dapp = dapp;
    }
    return this.dapp;
  }
}
