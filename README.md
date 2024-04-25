# Gate Keeping Lit Decryption by Reading from an Unsupported Chain

Currently Stellar is not one of the [listed supported chains](https://developer.litprotocol.com/v2/resources/supportedchains#:~:text=Our%20Access%20Control%20Protocol%20supports,the%20Cosmos%20ecosystem%2C%20and%20Solana.) by Lit. This repo provides an example of how you can use a Lit Action to make a call to Stellar's network to determine whether or not a user is allowed to decrypt some data encrypted using Lit.

## How This Example Works

This repo contains two directories:

- `lit`
- `stellar-contracts`

### `lit` Directory

This directory contains the JavaScript code that utilizes the Lit SDK to encrypt some data and uses a Lit Action and a secret number to determine whether or not decryption of that data is allowed using the Lit network.

#### [`src/index.js`](./lit/src/index.js)

This file contains the Lit SDK code responsible for encrypting a string and calling the Lit Action to attempt decryption.

##### Connecting the Lit Habanero Network

The first thing we need to do is create a Lit Client connected to the `habanero` network:

```javascript
const client = new LitJsSdk.LitNodeClientNodeJs({
  litNetwork: "habanero",
});
await client.connect();
```

##### Creating an Auth Signature

Then we need to create an [Auth Sig](https://developer.litprotocol.com/v2/sdk/explanation/authentication/authsig):

```javascript
const authSig = await getAuthSig(client);
```

We use a provided private key (given to us as an ENV) to create an `ethers` wallet, then create a Sign in With Ethereum (SIWE) message, sign it, then return an object that is our Auth Sig.

```javascript
function getPrivateKey() {
  if (process.env.PRIVATE_KEY === undefined)
    throw new Error("Please provide the env: PRIVATE_KEY");
  return process.env.PRIVATE_KEY;
}

function getWallet() {
  return new ethers.Wallet(getPrivateKey());
}

async function getAuthSig(client) {
  const wallet = getWallet();
  const address = ethers.getAddress(await wallet.getAddress());
  const messageToSign = (
    await getSiweMessage(client, address)
  ).prepareMessage();
  const signature = await wallet.signMessage(messageToSign);

  return {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: messageToSign,
    address,
  };
}
```

Our method to create the SIWE message to sign looks like:

```javascript
async function getSiweMessage(client, address) {
  const domain = "localhost";
  const origin = "https://localhost/login";
  const statement =
    "This is a test statement.  You can put anything you want here.";

  // Expiration time in ISO 8601 format. This is 7 days in the future
  const expirationTime = new Date(
    Date.now() + 1000 * 60 * 60 * 24 * 7
  ).toISOString();

  return new siwe.SiweMessage({
    domain,
    address,
    statement,
    uri: origin,
    version: "1",
    chainId: 1,
    nonce: await client.getLatestBlockhash(),
    expirationTime,
  });
}
```

##### Creating Our Access Control Conditions

After obtaining an Auth Sig, our next step is to create the [Access Control Conditions](https://developer.litprotocol.com/v3/sdk/access-control/condition-types/unified-access-control-conditions) (ACC):

```javascript
const accessControlConditions = [
  {
    contractAddress: "ipfs://QmcyrxqaLSDjYZpxJUQ3521fUfnVr86bSvLHRZHiaPhMyY",
    standardContractType: "LitAction",
    chain: "ethereum",
    method: "go",
    parameters: ["42"],
    returnValueTest: {
      comparator: "=",
      value: "true",
    },
  },
];
```

- `contractAddress` is the `ipfs` URI of our Lit Action that will be making the request to the Stellar network (more on this in the next section)
- `standardContractType` is us telling Lit that we intend to use a Lit Action for authorization
- `chain` should be `ethereum` even though we're using Stellar
- `method` is the name of the function for Lit Action that will be executed to determine authorization
- `parameters` is an array of arguments Lit will pass to our Lit Action when it's executed
- `returnValueTest` is a list of checks that must all pass in order for Lit to deem our request to decrypt our data as authorized. In our case we're just asserting that our Lit Action must return `true` to be considered an authorization

##### Encrypting Our String

```javascript
const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
  {
    accessControlConditions,
    authSig,
    chain: "ethereum",
    dataToEncrypt: "the answer to life, the universe, and everything is 42",
  },
  client
);
```

Here we're passing in our `accessControlConditions` and `authSig` we just defined, `chain` should be `ethereum`, and our `dataToEncrypt` is an arbitrary `string` in our case since we're using `LitJsSdk.encryptString`. However, there are [other encryption methods](https://developer.litprotocol.com/v3/sdk/access-control/quick-start#encryption) available if they better suite your use case. Lastly, we pass in our Lit Client (`client`) that we created in the beginning.

The return values, `ciphertext` and `dataToEncryptHash` are important to keep track of as encryption happens entirely client side and the Lit network has no record of these values. These values are also mandatory to have in order to perform the decryption of our data. These values will need to be stored and shared by you in order for anyone to perform decryption.

##### Decrypting Our String

```javascript
const decryptedString = await LitJsSdk.decryptToString(
  {
    accessControlConditions,
    ciphertext,
    dataToEncryptHash,
    authSig,
    chain: "ethereum",
  },
  client
);
console.log("decryptedString", decryptedString);
```

This code is what's responsible for making a request to Lit to execute our Lit Action to attempt to authorize us to decrypt the data. `accessControlConditions` is the same object we defined above, `ciphertext` and `dataToEncryptHash` are our return values from `LitJsSdk.encryptString`, `authSig` can be any valid Lit Auth Sig, here we are just reusing the one we created for encryption, `chain` should be `ethereum`, and lastly `client` is our Lit Client we created in the beginning.

`LitJsSdk.decryptToString` will use our Lit Client to submit our decryption request to the Lit Nodes running the Habanero testnet. Each Lit Node will pull our Lit Action that we uploaded to IPFS, execute the `method` we defined in our `accessControlConditions`, passing it the `parameters` we also defined in `accessControlConditions`, and will test the value returned by the Lit Action against the `returnValueTest` s we defined in our `accessControlConditions`.

If all the `returnValueTest`s pass, then each Lit Node will provide a [private key share](https://developer.litprotocol.com/v3/resources/glossary#private-key-share) that will be used to decrypt our data. Once we have enough key shares to meet the threshold for decryption, the Lit SDK will use the decryption key to decrypt our `ciphertext` and we'll get our original data `console.log`ed.

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
