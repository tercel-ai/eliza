# @elizaos/plugin-massa

## Overview

This plugin aims to be the basis of all interactions with the Massa ecosystem.

## Configuration

### Environment Variables

```env
MASSA_PRIVATE_KEY=
MASSA_RPC_URL=
```


## Adding a new action

Reuse providers and utilities from the existing actions where possible. Add more utilities if you think they will be useful for other actions.

1. Add the action to the `actions` directory. Try to follow the naming convention of the other actions.
2. Export the action in the `index.ts` file.


## MASSA documentation
[https://docs.massa.net/](https://docs.massa.net/)