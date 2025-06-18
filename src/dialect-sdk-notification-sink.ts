import {
  NotificationSink,
  NotificationSinkMetadata,
  SubscriberRepository,
} from './ports';
import { Notification, ResourceId } from './data-model';
import {
  BlockchainSdk,
  Dapp,
  DappMessageLinksAction,
  DialectSdk,
  IllegalStateError,
} from '@dialectlabs/sdk';
import { NotificationMetadata } from './monitor-builder';
import { uniqBy } from 'lodash';

export interface DialectSdkNotification extends Notification {
  title: string;
  message: string;
  imageUrl?: string;
  actions?: DappMessageLinksAction;
}

interface BufferedUnicastNotification {
  notification: DialectSdkNotification;
  recipient: ResourceId;
  metadata: NotificationSinkMetadata;
}

interface DialectSdkNotificationSinkOptions {
  debug?: boolean;
}

export class DialectSdkNotificationSink
  implements NotificationSink<DialectSdkNotification>
{
  private dapp: Dapp | null = null;
  private unicastBuffer: BufferedUnicastNotification[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private readonly bufferTimeMs: number = 10000; // 10 seconds
  private readonly bufferSize: number = 500;
  private readonly debug: boolean;

  constructor(
    private readonly sdk: DialectSdk<BlockchainSdk>,
    private readonly subscriberRepository: SubscriberRepository,
    options: DialectSdkNotificationSinkOptions = {},
  ) {
    this.debug = options.debug ?? false;
    this.startFlushInterval();
  }

  async push(
    { title, message, actions, imageUrl }: DialectSdkNotification,
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

        // Check if buffering should be used
        if (this.sdk.config.dialectCloud.apiVersion === 2) {
          await this.bufferUnicastNotification(
            { title, message, actions, imageUrl },
            theOnlyRecipient,
            { dispatchType, notificationMetadata },
          );
        } else {
          // Send immediately for non-v2 API
          await dapp.messages.send({
            title: title,
            message: message,
            recipient: theOnlyRecipient.toBase58(),
            notificationTypeId,
            imageUrl,
            actionsV2: actions,
          });
        }
      } else if (dispatchType === 'multicast') {
        if (recipients.length === 0) {
          return;
        }
        await dapp.messages.send({
          title: title,
          message: message,
          recipients: recipients.map((it) => it.toBase58()),
          notificationTypeId,
          actionsV2: actions,
        });
      } else if (dispatchType === 'broadcast') {
        await dapp.messages.send({
          title: title,
          message: message,
          notificationTypeId,
          actionsV2: actions,
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

  private startFlushInterval() {
    if (!this.flushInterval) {
      this.flushInterval = setInterval(() => {
        this.flushUnicastBuffer().catch(console.error);
      }, this.bufferTimeMs);

      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Started flush interval (${
            this.bufferTimeMs
          }ms)`,
        );
      }
    }
  }

  private async bufferUnicastNotification(
    notification: DialectSdkNotification,
    recipient: ResourceId,
    metadata: NotificationSinkMetadata,
  ) {
    // Add to buffer
    this.unicastBuffer.push({
      notification,
      recipient,
      metadata,
    });

    if (this.debug) {
      console.log(
        `[${new Date().toISOString()}] BUFFER: Added unicast notification to buffer. Buffer size: ${
          this.unicastBuffer.length
        }/${this.bufferSize}`,
      );
    }

    // Check if buffer size limit reached
    if (this.unicastBuffer.length >= this.bufferSize) {
      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Buffer size limit reached (${
            this.bufferSize
          }), triggering flush`,
        );
      }
      await this.flushUnicastBuffer();
    }
  }

  private async flushUnicastBuffer() {
    if (this.unicastBuffer.length === 0) {
      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Flush called but buffer is empty, skipping`,
        );
      }
      return;
    }

    // Get buffered notifications
    const notificationsToSend = [...this.unicastBuffer];
    this.unicastBuffer = [];

    if (this.debug) {
      console.log(
        `[${new Date().toISOString()}] BUFFER: Flushing ${
          notificationsToSend.length
        } notifications`,
      );
    }

    try {
      const dapp = await this.lookupDapp();

      // Send each buffered notification
      for (const { notification, recipient, metadata } of notificationsToSend) {
        const notificationTypeId = await this.tryResolveNotificationTypeId(
          metadata.notificationMetadata,
        );

        await dapp.messages.send({
          title: notification.title,
          message: notification.message,
          recipient: recipient.toBase58(),
          notificationTypeId,
          imageUrl: notification.imageUrl,
          actionsV2: notification.actions,
        });
      }

      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Successfully flushed ${
            notificationsToSend.length
          } notifications`,
        );
      }
    } catch (e) {
      console.error(
        `Failed to flush unicast buffer, reason: ${JSON.stringify(e)}`,
      );
      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Flush failed with error: ${JSON.stringify(
            e,
          )}`,
        );
      }
    }
  }

  // Public method to manually flush buffer (useful for cleanup)
  async flush() {
    if (this.debug) {
      console.log(
        `[${new Date().toISOString()}] BUFFER: Manual flush requested`,
      );
    }
    await this.flushUnicastBuffer();
  }

  // Cleanup method to clear interval
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      if (this.debug) {
        console.log(
          `[${new Date().toISOString()}] BUFFER: Destroyed - cleared flush interval`,
        );
      }
    }
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
    const availableNotificationTypes = uniqBy(
      subscribers
        .flatMap((it) => it.notificationSubscriptions ?? [])
        .map((it) => it.notificationType),
      (it) => it.id,
    );
    const notificationType = availableNotificationTypes.find(
      (it) =>
        it.humanReadableId.toLowerCase() === notificationTypeId.toLowerCase() ||
        it.id === notificationTypeId,
    );
    if (availableNotificationTypes.length > 0 && !notificationType) {
      throw new IllegalStateError(
        `Unknown notification type ${notificationTypeId}, must be one of [${availableNotificationTypes.map(
          (it) => it.humanReadableId,
        )}] or one of [${availableNotificationTypes.map((it) => it.id)}]`,
      );
    }
    return notificationType?.id;
  }

  private async lookupDapp() {
    if (!this.dapp) {
      const dapp = await this.sdk.dapps.find();
      if (!dapp) {
        throw new IllegalStateError(
          `Dapp ${this.sdk.wallet.address} not registered in dialect cloud ${this.sdk.config.dialectCloud}`,
        );
      }
      this.dapp = dapp;
    }
    return this.dapp;
  }
}
