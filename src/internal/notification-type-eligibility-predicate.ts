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
    if (notificationSubscriptions && !metadata?.type) {
      return false;
    }
    return Boolean(
      notificationSubscriptions.find(
        (subscription) =>
          subscription.notificationType.id === metadata?.type.id ||
          subscription.notificationType.humanReadableId.toLowerCase() ===
            metadata?.type.id?.toLowerCase(),
      ),
    );
  }
}
