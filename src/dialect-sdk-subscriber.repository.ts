import { PublicKey } from '@solana/web3.js';
import {
  Subscriber,
  SubscriberEventHandler,
  SubscriberNotificationSubscription,
  SubscriberRepository,
} from './ports';
import _ from 'lodash';
import {
  AddressType,
  BlockchainSdk,
  Dapp,
  DialectSdk,
  IllegalStateError,
} from '@dialectlabs/sdk';

export class DialectSdkSubscriberRepository implements SubscriberRepository {
  private dapp: Dapp | null = null;

  constructor(private sdk: DialectSdk<BlockchainSdk>) {}

  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    throw new Error('Method not implemented.');
  }

  async findAll(): Promise<Subscriber[]> {
    const addressSubscribers = await this.findAddressSubscribers();
    const notificationSubscribers =
      await this.findNotificationTypeSubscribers();
    return _.values(
      _.merge(
        _.keyBy(addressSubscribers, (it) => it.resourceId.toBase58()),
        _.keyBy(notificationSubscribers, (it) => it.resourceId.toBase58()),
      ),
    );
  }

  private async findAddressSubscribers(): Promise<Subscriber[]> {
    const dapp = await this.lookupDapp();
    const dappAddresses = await dapp.dappAddresses.findAll();
    return _(dappAddresses)
      .filter(({ enabled, address: { verified } }) => enabled && verified)
      .map((it) => ({
        resourceId: it.address.wallet.address,
        ...(it.address.type === AddressType.Email && {
          email: it.address.value,
        }),
        ...(it.address.type === AddressType.Telegram && {
          telegramChatId: it.channelId,
        }),
        ...(it.address.type === AddressType.PhoneNumber && {
          phoneNumber: it.address.value,
        }),
        ...(it.address.type === AddressType.Wallet && {
          wallet: new PublicKey(it.address.value),
        }),
      }))
      .groupBy('resourceId')
      .mapValues((s, resourceId) => ({
        resourceId: new PublicKey(resourceId),
        telegramChatId: s
          .map(({ telegramChatId }) => telegramChatId)
          .find((it) => it),
        phoneNumber: s.map(({ phoneNumber }) => phoneNumber).find((it) => it),
        email: s.map(({ email }) => email).find((it) => it),
        wallet: s.map(({ wallet }) => wallet).find((it) => it),
      }))
      .values()
      .value();
  }

  private async findNotificationTypeSubscribers(): Promise<Subscriber[]> {
    const dapp = await this.lookupDapp();
    const notificationTypes = await dapp.notificationTypes.findAll();
    if (notificationTypes.length === 0) {
      return [];
    }
    const dappNotificationSubscriptions =
      await dapp.notificationSubscriptions.findAll();
    return _(dappNotificationSubscriptions)
      .flatMap(({ subscriptions, notificationType }) =>
        subscriptions.map((subscription) => {
          const notificationSubscription: SubscriberNotificationSubscription = {
            notificationType: {
              id: notificationType.id,
              humanReadableId: notificationType.humanReadableId,
            },
            config: subscription.config,
          };
          return {
            resourceId: subscription.wallet.address,
            subscription: notificationSubscription,
          };
        }),
      )
      .groupBy('resourceId')
      .mapValues((s, resourceId) => {
        const subscriber: Subscriber = {
          resourceId: new PublicKey(resourceId),
          notificationSubscriptions: s
            .filter((it) => it.subscription.config.enabled)
            .map((it) => it.subscription),
        };
        return subscriber;
      })
      .values()
      .value();
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
