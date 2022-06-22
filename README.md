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

### 000-real-monitoring-service

This example emulates e2e scenario for monitoring some on chain resources for a set of subscribers and has 2 parts:

1) Client that emulates several users subscribing for dialect notifications from a monitoring service
2) Server that monitors some data on chain for a set of monitoring service subscribers

The server implementation is provided below

```typescript
import { Monitor, Monitors, Pipelines, ResourceId, SourceData } from '@dialectlabs/monitor';
import { Dialect, NodeDialectWalletAdapter } from '@dialectlabs/sdk';
import { Duration } from 'luxon';

type DataType = {
  cratio: number;
  healthRatio: number;
};

const monitor: Monitor<DataType> = Monitors.builder({
  sdk: Dialect.sdk({
    environment: 'local-development',
    wallet: NodeDialectWalletAdapter.create(),
  })
  // ... other configuration
})
  .defineDataSource<DataType>()
  .poll((subscribers: ResourceId[]) => {
    const sourceData: SourceData<DataType>[] = // ... extract data from chain for set of subscribers
    return Promise.resolve(sourceData);
  }, Duration.fromObject({ seconds: 3 }))
  .transform<number, number>({
    keys: ['cratio'],  // select a subset of attrributes from DataType
    pipelines: [
      // Send notification each time when value falling below the threshold 
      Pipelines.threshold(
        {
          type: 'falling-edge',
          threshold: 0.5,
        },
        // ... Optionally you can limit rate of the messages
        {
          type: 'throttle-time',
          timeSpan: Duration.fromObject({ minutes: 5 }),
        },
      ),
    ],
  })
  .notify()
  .email(({ value }) => ({
    subject: '[WARNING] Cratio above warning threshold',
    text: `Your cratio = ${value} above warning threshold`,
  }))
  .dialectThread(({ value }) => ({
    message: `Your cratio = ${value} above warning threshold`,
  }))
  .and()
  .dispatch('unicast')
  .build();

monitor.start();
// ...
```

Please follow the instructions below to run the example

#### Step 1. Run a solana validator node with dialect program

Please follow the instructions in https://github.com/dialectlabs/protocol#local-development

#### Step 2. generate a new keypair for monitoring service and fund it

```bash
export your_path=~/projects/dialect/keypairs/
solana-keygen new --outfile ${your_path}/monitor-localnet-keypair.private
solana-keygen pubkey ${your_path}/monitor-localnet-keypair.private > ${your_path}/monitor-localnet-keypair.public
solana -k ${your_path}/monitor-localnet-keypair.public airdrop 3
```

#### Step 2. Start server

```bash
cd examples
export your_path=~/projects/dialect/keypairs
DIALECT_SDK_CREDENTIALS=$(cat ${your_path}/monitor-localnet-keypair.private) ts-node ./000.2-real-monoring-service-server.ts
```

#### Step 3. Start client

```bash
cd examples
export your_path=~/projects/dialect/keypairs
DAPP_PUBLIC_KEY=$(cat ${your_path}/monitor-localnet-keypair.public) \
DAPP_PRIVATE_KEY=$(cat ${your_path}/monitor-localnet-keypair.private) \
ts-node ./000.1-real-monoring-service-client.ts
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

Shows an example of how to define custom subscriber repository instead of getting this data from on-chain program
accounts. Useful for local development.

### 004-custom-notification-sink

Shows an example of how to define notification sink instead of sending notifications via on-chain program. Useful for
local development.

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
