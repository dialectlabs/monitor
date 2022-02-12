# Monitor

A framework that simplifies implementation of dialect notification center integrations. The goal is to provide high-level developer API to extract on-chain data, transform it and generate notifications.

Monitor provides the following built-in features to implement a new notification center integration:

1. Tracks dApp subscribers
2. Continuously monitors on-chain resources like accounts for a set of your dApp subscribers
3. Provides rich high-level API for data stream processing to analyze the data, extracted from on-chain resources

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

#### Take a look at examples in ./examples directory ad corresponding readme file

After getting familiar with examples you'll be ready to implement a new monitoring service.