import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import { Notification, ResourceId } from './data-model';
import { Dapp, DialectSdk, IllegalStateError } from '@dialectlabs/sdk';
import { NotificationMetadata } from './monitor-builder';

export interface DialectSdkNotification extends Notification {
  title: string;
  message: string;
}

export class DialectSdkNotificationSink
  implements NotificationSink<DialectSdkNotification>
{
  private dapp: Dapp | null = null;

  constructor(
    private readonly sdk: DialectSdk,
    private readonly subscriberRepository: SubscriberRepository,
  ) {}

  async push(
    { title, message }: DialectSdkNotification,
    recipients: ResourceId[],
    { dispatchType, notificationMetadata }: NotificationSinkMetadata,
  ) {
    try {
      const notificationTypeId = await this.tryResolveNotificationTypeId(
        notificationMetadata,
      );
      const dapp = await this.lookupDapp();
      if (dispatchType === 'unicast') {
        const theOnlyRecipient = recipients[0];
        if (!theOnlyRecipient) {
          throw new IllegalStateError(
            `No recipient specified for unicast notification`,
          );
        }
        await dapp.messages.send({
          title: title,
          message: message,
          recipient: theOnlyRecipient,
          notificationTypeId,
        });
      } else if (dispatchType === 'multicast') {
        if (recipients.length === 0) {
          return;
        }
        await dapp.messages.send({
          title: title,
          message: message,
          recipients: recipients,
          notificationTypeId,
        });
      } else if (dispatchType === 'broadcast') {
        await dapp.messages.send({
          title: title,
          message: message,
          notificationTypeId,
        });
      } else {
        console.error(
          `Dialect SDK notification sink does not support this dispatch type: ${dispatchType}.`,
        );
      }
    } catch (e) {
      console.error(
        `Failed to send dialect sdk notification, reason: ${JSON.stringify(e)}`,
      );
    }
    return;
  }

  private tryResolveNotificationTypeId(
    notificationMetadata?: NotificationMetadata,
  ) {
    const notificationTypeId = notificationMetadata?.type.id;
    if (notificationTypeId) {
      return this.resolveNotificationTypeId(notificationTypeId);
    }
  }

  private async resolveNotificationTypeId(notificationTypeId: string) {
    const subscribers = await this.subscriberRepository.findAll();
    const availableNotificationTypes = subscribers
      .flatMap((it) => it.notificationSubscriptions ?? [])
      .map((it) => it.notificationType);
    const notificationType = availableNotificationTypes.find(
      (it) =>
        it.humanReadableId.toLowerCase() === notificationTypeId.toLowerCase() ||
        it.id === notificationTypeId,
    );
    if (availableNotificationTypes.length > 0 && !notificationType) {
      throw new IllegalStateError(
        `Unknown notification type ${notificationTypeId}, must be one of [${availableNotificationTypes.map(
          (it) => it.humanReadableId,
        )}]`,
      );
    }
    return notificationType?.id;
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
