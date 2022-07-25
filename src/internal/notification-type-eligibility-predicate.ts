import { Subscriber } from '../ports';
import { NotificationMetadata } from '../monitor-builder';

export abstract class NotificationTypeEligibilityPredicate {
  abstract isEligible(
    subscriber: Subscriber,
    metadata?: NotificationMetadata,
  ): Boolean;

  static create() {
    return new DefaultNotificationTypeEligibilityPredicate();
  }
}

export class DefaultNotificationTypeEligibilityPredicate extends NotificationTypeEligibilityPredicate {
  isEligible(
    { notificationSubscriptions }: Subscriber,
    metadata?: NotificationMetadata,
  ): Boolean {
    if (!notificationSubscriptions) {
      return true;
    }
    if (notificationSubscriptions?.length > 0 && !metadata?.type?.id) {
      console.warn(
        `Notification type id must be explicitly set and match dapp notification types configuration. Skipping some notifications...`,
      );
      return false;
    }
    const found = Boolean(
      notificationSubscriptions.find(
        (subscription) =>
          subscription.notificationType.id === metadata?.type.id ||
          subscription.notificationType.humanReadableId.toLowerCase() ===
            metadata?.type.id?.toLowerCase(),
      ),
    );
    if (!found && metadata?.type.id) {
      console.warn(
        `Unknown notification type ${
          metadata.type.id
        }, must be one of [${notificationSubscriptions.map(
          (it) => it.notificationType.humanReadableId,
        )}]`,
      );
    }
    return found;
  }
}
