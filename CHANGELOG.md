# CHANGELOG

## [UNRELEASED]

## [3.4.2] - 2022-12-23

- chore: add available notification type ids to notification type id resolving error

## [3.4.1] - 2022-12-23

- chore: shorten error message in dialect-sdk notification sink on notification type mismatch

## [3.4.0] - 2022-12-09

- Bump SDK to 1.4.0, blockchain-sdk-aptos 1.0.3, blockchain-sdk-solana 1.0.1

## [3.3.3] - 2022-09-11

- fix: skip sending notifications for empty recipient sets in dialect sdk sink

## [3.3.2] - 2022-08-08

- chore: shorten subscribers logging.

## [3.3.1] - 2022-08-07

- Bump sdk dependency to 0.5.1.

## [3.3.0] - 2022-07-27

- Add configurable notification types.

## [3.1.0] - 2022-07-06

- Add pipeline for tracking change of arbitrary value based on user-provided comparator.

## [3.0.3] - 2022-06-22

- Increase poll timeout threshold for larger poll intervals.

## [3.0.2] - 2022-06-22

- Bump sdk dependency to 0.2.0.

## [3.0.1] - 2022-06-22

- Bump sdk dependency to 0.1.4.

## [3.0.0] - 2022-06-22

- Migrate to Dialect SDK for all underlying API calls and monitor initialization.
- Add monitor client that can be used to emulate subscribers and auto-register dapp in Dialect.

## [2.3.0] - 2022-06-16

- Add Solflare notification sink.

## [2.2.0] - 2022-05-26

- Switch to Bearer authN based on dApp signed token for requests targeting dialect web2 services.

## [2.1.0] - 2022-05-19

- Support setting a limit for which rising and falling edge triggers stop firing event.

## [2.0.8] - 2022-05-18

- Start collecting changelog.
