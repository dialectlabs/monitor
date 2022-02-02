# Terminology

1. Data source is an abstraction that represents a set of resource-specific parameters that need to be ingested,
   optionally transformed and sent to user. Each data source provides access to multiple resources.
2. Resource is an abstraction that represents any entity that is addressable on chain (e.g. user or PDA)
3. Parameter is an abstraction that represents a resource-bound data structure or scalar value that is stored on chain

Data source <-- 1...n --> Resource <-- n...n --> Parameter

# Requirements

## Data model

1. Single data source

## Data ingestion patterns to be supported

1. Pull (selected for MVP)
2. Push

## Data models supported

1. Numeric scalar (selected for MVP)
2. Any object

## Data source patterns

1. Push



