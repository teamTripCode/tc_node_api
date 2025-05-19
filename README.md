# TripCodeChain Client Node

This is a simple NestJS application that connects with the TripCodeChain seed node. The client automatically registers with the seed node upon startup and maintains a persistent connection with it.

## Description

The client node connects to a specified seed node, registers itself in the network, and periodically performs health checks to maintain the connection. It also provides a simple API to check its status and retrieve information about other nodes in the network.

## Features

- Automatic connection to seed node on startup
- Automatic registration and reconnection logic
- Health checks via periodic pings
- Configurable connection parameters via environment variables
- Simple REST API to check node status and network information

## Installation

```bash
$ npm install
```

## Configuration

The application can be configured through environment variables:

- `SEED_NODE_ADDRESS`: Address of the seed node (default: `localhost:3000`)
- `NODE_PORT`: Port on which this client node runs (default: `3100`)
- `NODE_HOST`: Hostname of this client node (default: `localhost`)
- `PING_INTERVAL`: Interval for health checks in milliseconds (default: `30000`)
- `RECONNECT_INTERVAL`: Interval for reconnection attempts in milliseconds (default: `10000`)
- `MAX_RECONNECT_ATTEMPTS`: Maximum reconnection attempts (default: `5`)

You can set these variables in a `.env` file in the project root.

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## API Endpoints

- `GET /` - Welcome message
- `GET /seed-node/status` - Get connection status with the seed node
- `GET /seed-node/nodes` - Get all known nodes in the network
- `GET /seed-node/active-nodes` - Get all active nodes in the network

## Example .env file

```
SEED_NODE_ADDRESS=localhost:3000
NODE_PORT=3100
NODE_HOST=localhost
PING_INTERVAL=30000
RECONNECT_INTERVAL=10000
MAX_RECONNECT_ATTEMPTS=5
```
