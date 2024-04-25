# Gate Keeping Lit Decryption by Reading from an Unsupported Chain

Currently Stellar is not one of the [listed supported chains](https://developer.litprotocol.com/v2/resources/supportedchains#:~:text=Our%20Access%20Control%20Protocol%20supports,the%20Cosmos%20ecosystem%2C%20and%20Solana.) by Lit. This repo provides an example of how you can use a Lit Action to make a call to Stellar's network to determine whether or not a user is allowed to decrypt some data encrypted using Lit.

## How This Example Works

This repo contains two directories:

- `lit`
- `stellar-contracts`

### `stellar-contracts` Directory

This directory contains the [Rust Stellar smart contract](./stellar-contracts/contracts/is_magic_number/src/lib.rs) with two functions:

- `is_magic_number` - This function is intended to showcase how some data provided to a Lit Actions can be provided to a Stellar smart contract to deem whether or not something should be authorized to perform decryption using Lit's network

```rust
pub fn is_magic_number(_env: Env, number: u32) -> bool {
    number == 42
}
```

- `always_true` - This is a test function used to always authorization

```rust
pub fn always_true(_env: Env) -> bool {
    true
}
```

This smart contract is deployed to the Stellar testnet which is periodically reset, so this contract may need to be deployed again in order for this example to function.

#### Deploying the Contract to Stellar Testnet

1. Follow [this setup guide](https://developers.stellar.org/docs/smart-contracts/getting-started/setup#install-the-target) to setup the `soroban` CLI
2. Configure an identity to submit transaction to the testnet:
   ```
   soroban keys generate --global alice --network testnet
   ```
3. Compile the smart contract:
   ```
   soroban contract build
   ```
4. Deploy the contract
   ```
   soroban contract deploy \
   --wasm stellar-contracts/target/wasm32-unknown-unknown/release/is_magic_number.wasm \
   --source alice \
   --network testnet
   ```
   The output of this command will be the smart contract address we use to submit transactions to, make sure to copy it and save it for later (you're going to need to paste it in [`litAction_simulate.js`](lit/src/litAction_simulate.js) for the `contractAddress` `const`):
   ```
   CCIRVLI5WAHVPOU5FXHWPKVTMBCADQFXGJS4ACSUBKT55GCOPTGN5KPQ
   ```

#### Verifying the Smart Contract Works as Intended

You can manually call the smart contract functions to verify it's working as intended:

- `is_magic_number`:
  ```
  soroban contract invoke \
  --id CCIRVLI5WAHVPOU5FXHWPKVTMBCADQFXGJS4ACSUBKT55GCOPTGN5KPQ \
  --source alice \
  --network testnet \
  -- \
  is_magic_number \
  --number 42
  ```
  should return `true` while replacing `--number 42` with any other number should return `false`
- `always_true`:
  ```
  soroban contract invoke \
  --id CCIRVLI5WAHVPOU5FXHWPKVTMBCADQFXGJS4ACSUBKT55GCOPTGN5KPQ \
  --source littest \
  --network testnet \
  -- \
  always_true
  ```
  should always return `true`

### `lit` Directory

This directory contains the JavaScript code that utilizes the Lit SDK to encrypt some data and uses a Lit Action and a secret number to determine if whether or not decryption of that data is allowed using the Lit network.

```
[`src/index.js`](./lit/src/index.js)
```
