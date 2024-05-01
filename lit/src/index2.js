import { LitContracts } from "@lit-protocol/contracts-sdk";
import {
  encryptString,
  decryptToString,
  LitNodeClientNodeJs,
} from "@lit-protocol/lit-node-client-nodejs";
import { LocalStorage } from "node-localstorage";
import { Wallet } from "ethers";
import { SiweMessage } from "siwe";
import { LitAbility, LitActionResource } from "@lit-protocol/auth-helpers";

const TEST_SECONDARY_WALLET_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const TEST_SECONDARY_WALLET = getWallet(TEST_SECONDARY_WALLET_PRIVATE_KEY);

(async () => {
  //   const capacityTokenIdStr = await mintCapacityCredit();
  const capacityTokenIdStr = "1157";
  const litNodeClient = await getLitNodeClient();
  const capacityDelegationAuthSig = await getCapacityDelegationAuthSig(
    litNodeClient,
    capacityTokenIdStr
  );
  const sessionSigs = await getSessionSigs(
    litNodeClient,
    capacityDelegationAuthSig,
    TEST_SECONDARY_WALLET
  );
  const accessControlConditions = getAccessControlConditions();

  const { ciphertext, dataToEncryptHash } = await encryptString(
    {
      accessControlConditions,
      chain: "ethereum",
      sessionSigs,
      dataToEncrypt: "the answer to life, the universe, and everything is 42",
    },
    litNodeClient
  );

  const decryptedString = await decryptToString(
    {
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      sessionSigs,
      chain: "ethereum",
    },
    litNodeClient
  );
  console.log("decryptedString", decryptedString);
})();

function getWallet(privateKey) {
  if (privateKey !== undefined)
    return new Wallet(privateKey, "https://chain-rpc.litprotocol.com/http");

  if (process.env.PRIVATE_KEY === undefined)
    throw new Error("Please provide the env: PRIVATE_KEY");

  return new Wallet(
    process.env.PRIVATE_KEY,
    "https://chain-rpc.litprotocol.com/http"
  );
}

async function getLitNodeClient() {
  const litNodeClient = new LitNodeClientNodeJs({
    litNetwork: "habanero",
    storageProvider: {
      provider: new LocalStorage("./storage.test.db"),
    },
  });
  await litNodeClient.connect();
  return litNodeClient;
}

async function getCapacityDelegationAuthSig(litNodeClient, capacityTokenIdStr) {
  const { capacityDelegationAuthSig } =
    await litNodeClient.createCapacityDelegationAuthSig({
      uses: "10",
      dAppOwnerWallet: getWallet(),
      capacityTokenId: capacityTokenIdStr,
      delegateeAddresses: [TEST_SECONDARY_WALLET.address],
    });
  return capacityDelegationAuthSig;
}

function getAuthNeededCallback(litNodeClient, wallet) {
  /**
   * When the getSessionSigs function is called, it will generate a session key
   * and sign it using a callback function. The authNeededCallback parameter
   * in this function is optional. If you don't pass this callback,
   * then the user will be prompted to authenticate with their wallet.
   */
  return async ({ resources, expiration, uri }) => {
    const nonce = await litNodeClient.getLatestBlockhash();
    let siweMessage = new SiweMessage({
      domain: "localhost", // change to your domain ex: example.app.com
      address: wallet.address,
      statement: "Sign a session key to use with Lit Protocol", // configure to what ever you would like
      uri,
      version: "1",
      chainId: "1",
      expirationTime: expiration,
      resources,
      nonce,
    });

    const messageToSign = siweMessage.prepareMessage();
    const signature = await wallet.signMessage(messageToSign);

    const authSig = {
      sig: signature,
      derivedVia: "web3.eth.personal.sign",
      signedMessage: messageToSign,
      address: wallet.address,
    };

    return authSig;
  };
}

async function getSessionSigs(
  litNodeClient,
  capacityDelegationAuthSig,
  wallet
) {
  return litNodeClient.getSessionSigs({
    chain: "ethereum",
    expiration: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours
    resourceAbilityRequests: [
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.LitActionExecution,
      },
      {
        resource: new LitActionResource("*"),
        ability: LitAbility.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback: getAuthNeededCallback(litNodeClient, wallet),
    capacityDelegationAuthSig,
  });
}

function getAccessControlConditions() {
  return [
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
}

async function mintCapacityCredit() {
  const litContractClient = new LitContracts({
    // signer: getWallet(),
    privateKey: process.env.PRIVATE_KEY,
    network: "manzano",
  });
  await litContractClient.connect();

  const { capacityTokenIdStr } = litContractClient.mintCapacityCreditsNFT({
    requestsPerSecond: 10,
    daysUntilUTCMidnightExpiration: 2,
  });
  return capacityTokenIdStr;
}
