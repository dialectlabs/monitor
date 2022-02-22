# Examples

Here you can browse a set of examples that can be used as a reference and how-to guide to develop a new monitoring
service. Examples start from real application using solana blockchain and dialect program, then we provide some examples
that don't use solana dependency to run.

## 000-real-monitoring-service

This example emulates e2e scenario for monitoring some on chain resources for a set of subscribers and has 2 parts:

1) Client that emulates several users subscribing for dialect notifications from a monitoring service
2) Server that monitors some data on chain for a set of monitoring service subscribers

### Step 1. Run a solana validator node with dialect program

Please follow the instructions in https://github.com/dialectlabs/protocol#local-development

### Step 2. generate a new keypair for monitoring service and fund it

```bash
export your_path=~/projects/dialect
solana-keygen new --outfile ${your_path}/monitoring-service-dev-local-key.json
solana-keygen pubkey ${your_path}/monitoring-service-dev-local-key.json > ${your_path}/monitoring-service-dev-local-key.pub
solana -k ${your_path}/monitoring-service-dev-local-key.json airdrop 3
```

### Step 2. Start server

```bash
cd examples
export your_path=~/projects/dialect
MONITORING_SERVICE_PRIVATE_KEY=$(cat ${your_path}/monitoring-service-dev-local-key.json) ts-node ./000.2-real-monoring-service-server.ts
```

### Step 3. Start client

```bash
cd examples
export your_path=~/projects/dialect
MONITORING_SERVICE_PUBLIC_KEY=$(solana address --keypair ${your_path}/monitoring-service-dev-local-key.json) ts-node ./000.1-real-monoring-service-client.ts
```

### Step 4. Look at client logs for notifications

When both client and server are started, server will start polling data and notifying subscribers

## 001-data-source-monitor

Show an example of how to define custom data source, transform data and generate notifications Doesn't exchange data
with on-chain program for development simplicity.

### Start this example

```bash
cd examples
ts-node ./001-data-source-monitor.ts
```

## 002-subscribers-monitor

Show an example of how subscribe to events about subscriber state changes and generate notifications. Useful e.g. for
sending new subscriber greetings or cleaning some data when subscriber removed. Doesn't exchange data with on-chain
program for development simplicity.

### Start this example

```bash
cd examples
ts-node ./002-subscribers-monitor.ts
```

## 003-custom-subscriber-repository

Show an example of how to define custom subscriber repository instead of getting this data from on-chain program
accounts. Useful for local development.

## 004-custom-notification-sink

Show an example of how to define notification sink instead of sending notifications via on-chain program. Useful for
local development.

## 005-custom-pipelines-using-operators

Show an example of how to develop an analytical pipeline using a set of subsequent more low-level transformation
operators.