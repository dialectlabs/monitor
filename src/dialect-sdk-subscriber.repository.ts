import { PublicKey } from '@solana/web3.js';
import {
  Subscriber,
  SubscriberEventHandler,
  SubscriberNotificationSubscription,
  SubscriberRepository,
} from './ports';
import { ResourceId } from './data-model';
import _ from 'lodash';
import {
  AddressType,
  Dapp,
  DialectSdk,
  IllegalStateError,
} from '@dialectlabs/sdk';

export class DialectSdkSubscriberRepository implements SubscriberRepository {
  private dapp: Dapp | null = null;

  constructor(private sdk: DialectSdk) {}

  subscribe(
    onSubscriberAdded?: SubscriberEventHandler,
    onSubscriberRemoved?: SubscriberEventHandler,
  ) {
    throw new Error('Method not implemented.');
  }

  async findByResourceId(resourceId: ResourceId): Promise<Subscriber | null> {
    const subscribers = await this.findAll();
    return subscribers.find((it) => it.resourceId.equals(resourceId)) ?? null;
  }

  async findAll(resourceIds?: ResourceId[]): Promise<Subscriber[]> {
    const addressSubscribers = await this.findAddressSubscribers();
    const notificationSubscribers =
      await this.findNotificationTypeSubscribers();
    const merged = _.values(
      _.merge(
        _.keyBy(addressSubscribers, (it) => it.resourceId.toBase58()),
        _.keyBy(notificationSubscribers, (it) => it.resourceId.toBase58()),
      ),
    );
    return merged.filter(({ resourceId }) =>
      !resourceIds ? true : resourceIds.find((it) => it.equals(resourceId)),
    );
  }

  private async findAddressSubscribers() {
    const dapp = await this.lookupDapp();
    const dappAddresses = await dapp.dappAddresses.findAll();
    const subscribers: Subscriber[] = _(dappAddresses)
      .filter(({ enabled, address: { verified } }) => enabled && verified)
      .map((it) => ({
        resourceId: it.address.wallet.publicKey,
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
    return subscribers;
  }

  private async findNotificationTypeSubscribers() {
    const dapp = await this.lookupDapp();
    const dappNotificationSubscriptions =
      await dapp.notificationSubscriptions.findAll();
    const subscribers: Subscriber[] = _(dappNotificationSubscriptions)
      .flatMap(({ subscriptions, notificationType }) =>
        subscriptions.map((subscription) => {
          const notificationSubscription: SubscriberNotificationSubscription = {
            notificationType,
            config: subscription.config,
          };
          return {
            resourceId: subscription.wallet.publicKey,
            subscription: notificationSubscription,
          };
        }),
      )
      .filter((it) => it.subscription.config.enabled)
      .groupBy('resourceId')
      .mapValues((s, resourceId) => {
        const subscriber: Subscriber = {
          resourceId: new PublicKey(resourceId),
          notificationSubscriptions: s.map((it) => it.subscription),
        };
        return subscriber;
      })
      .values()
      .value();
    return subscribers;
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
