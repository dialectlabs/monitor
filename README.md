# Monitoring Toolkit

Monitor is an open-source framework that makes it easy to extract and transform on-chain data into targeted, timely smart messages. You can implement a monitor service to provide your dApp's users with smart messages.

The monitor framework provides features to seamlessly integrate notifications with your dApp:
1. Ability to track dApp users that subscribe to notifications
2. Ability to continuously monitor on-chain resources, like accounts, for a set of your subscribers
3. A rich, high-level API for unbounded data-stream processing to analyze the extracted on-chain data

Data-stream processing features include:
  - Windowing: fixed size, fixed time, fixed size sliding
  - Aggregation: average, min, max
  - Thresholding: rising edge, falling edge
  - Rate limiting

## Installation

**npm:**

```shell
npm install @dialectlabs/monitor
```

**yarn:**

```shell
yarn add @dialectlabs/monitor
```

## Usage

Dialect's monitor is best learned by example. This section describes how to use Dialect monitor to build a monitoring apps by showing you various example apps in the `examples/` folder of this repository. Follow along in this section, & refer to the code in those examples.

Examples start from real application that is utilizing solana blockchain and dialect program, then we provide some examples
that don't utilize solana as a dependency to run for development simplicity.

### examples/000.1-solana-monitoring-service.ts

This example emulates e2e scenario for monitoring some on chain resources for a set of subscribers and has 2 parts:

1) Client that emulates several users subscribing for dialect notifications from a monitoring service
2) Server that monitors some data for a set of monitoring service subscribers

Server example:

```typescript
import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '../src';
import { Duration } from 'luxon';

// 1. Common Dialect SDK imports
import {
  Dialect,
  DialectCloudEnvironment,
  DialectSdk,
} from '@dialectlabs/sdk';

// 2. Solana-specific imports
import {
  Solana,
  SolanaSdkFactory,
  NodeDialectSolanaWalletAdapter
} from '@dialectlabs/blockchain-sdk-solana';

// 3. Create Dialect Solana SDK
const environment: DialectCloudEnvironment = 'development';
const dialectSolanaSdk: DialectSdk<Solana> = Dialect.sdk(
  {
    environment,
  },
  SolanaSdkFactory.create({
    // IMPORTANT: must set environment variable DIALECT_SDK_CREDENTIALS
    // to your dapp's Solana messaging wallet keypair e.g. [170,23, . . . ,300]
    wallet: NodeDialectSolanaWalletAdapter.create(),
  }),
);

// 4. Define a data type to monitor
type YourDataType = {
  cratio: number;
  healthRatio: number;
  resourceId: ResourceId;
};

// 5. Build a Monitor to detect and deliver notifications
const dataSourceMonitor: Monitor<YourDataType> = Monitors.builder({
  sdk: dialectSolanaSdk,
  subscribersCacheTTL: Duration.fromObject({ seconds: 5 }),
})
  // (5a) Define data source type
  .defineDataSource<YourDataType>()
  // (5b) Supply data to monitor, in this case by polling
  //     Push type available, see example 007
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<YourDataType>[] = subscribers.map(
      (resourceId) => ({
        data: {
          cratio: Math.random(),
          healthRatio: Math.random(),
          resourceId,
        },
        groupingKey: resourceId.toString(),
      }),
    );
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 3 }))
  // (5c) Transform data source to detect events
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'falling-edge',
        threshold: 0.5,
      }),
    ],
  })
  // (5d) Add notification sinks for message delivery strategy
  //     Monitor has several sink types available out-of-the-box.
  //     You can also define your own sinks to deliver over custom channels
  //     (see examples/004-custom-notification-sink)
  //     Below, the dialectSdk sync is used, which handles logic to send
  //     notifications to all all (and only) the channels which has subscribers have enabled
  .notify()
  .dialectSdk(
    ({ value }) => {
      return {
        title: 'dApp cratio warning',
        message: `Your cratio = ${value} below warning threshold`,
      };
    },
    {
      dispatch: 'unicast',
      to: ({ origin: { resourceId } }) => resourceId,
    },
  )
  .also()
  .transform<number, number>({
    keys: ['cratio'],
    pipelines: [
      Pipelines.threshold({
        type: 'rising-edge',
        threshold: 0.5,
      }),
    ],
  })
  .notify()
  .dialectSdk(
    ({ value }) => {
      return {
        title: 'dApp cratio warning',
        message: `Your cratio = ${value} above warning threshold`,
      };
    },
    {
      dispatch: 'unicast',
      to: ({ origin: { resourceId } }) => resourceId,
    },
  )
  // (5e) Build the Monitor
  .and()
  .build();

// 6. Start the monitor
dataSourceMonitor.start();

```

Please follow the instructions below to run the example

#### Step 1. Generate a new test keypair representing your dapp's monitoring service

```bash
export your_path=~/projects/dialect/keypairs/
solana-keygen new --outfile ${your_path}/monitor-localnet-keypair.private
solana-keygen pubkey ${your_path}/monitor-localnet-keypair.private > ${your_path}/monitor-localnet-keypair.public
```

#### Step 2. Start server with keypair assigned to env DIALECT_SDK_CREDENTIALS

```bash
cd examples
export your_path=~/projects/dialect/keypairs
DIALECT_SDK_CREDENTIALS=$(cat ${your_path}/monitor-localnet-keypair.private) ts-node ./000.1-solana-monitoring-service-server.ts
```

#### Step 3. Start client

```bash
cd examples
export your_path=~/projects/dialect/keypairs
DAPP_PUBLIC_KEY=$(cat ${your_path}/monitor-localnet-keypair.public) \
ts-node ./000.1-solana-monitoring-service-client.ts
```

#### Step 4. Look at client logs for notifications

When both client and server are started, server will start polling data and notifying subscribers

### 001-data-source-monitor

Shows an example of how to define custom data source, transform data and generate notifications Doesn't exchange data
with on-chain program for development simplicity.

#### Start this example

```bash
cd examples
ts-node ./001-data-source-monitor.ts
```

### 002-subscribers-monitor

Shows an example of how subscribe to events about subscriber state changes and generate notifications. Useful e.g. for
sending new subscriber greetings or cleaning some data when subscriber removed. Doesn't exchange data with on-chain
program for development simplicity.

### Start this example

```bash
cd examples
ts-node ./002-subscribers-monitor.ts
```

### 003-custom-subscriber-repository

Shows an example of how to define custom dummy subscriber repository instead of getting this data from DialectCloud. Useful for local development.

### 004-custom-notification-sink

Shows an example of how to write a custom notification sink. Console log example useful for local development.

### 005-custom-pipelines-using-operators

Shows an example of how to develop an analytical pipeline using a set of subsequent more low-level transformation
operators.

If you're interested in developing on Dialect while making live changes to the library, see the Development section below.

## Development

### Prerequisites

- Git
- Yarn (<2)
- Nodejs (>=15.10 <17)

### Getting started with monitor development in this repo

#### Install dependencies

**npm:**

```shell
npm install
```

**yarn:**

```shell
yarn
```

#### Take a look at examples and corresponding readme file

After getting familiar with https://github.com/dialectlabs/monitor/blob/main/examples/README.md and examples you'll be ready to implement a new monitoring service.
