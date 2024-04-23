import * as LitJsSdk from "@lit-protocol/lit-node-client-nodejs";
import { LitContracts } from "@lit-protocol/contracts-sdk";
import { ethers } from "ethers";
import siwe from "siwe";

(async () => {
  const client = new LitJsSdk.LitNodeClientNodeJs({
    litNetwork: "habanero",
  });
  await client.connect();

  const authSig = await getAuthSig();

  const accessControlConditions = [
    {
      contractAddress: "ipfs://Qmek1vq8BkpEdpvdwtYNLk9AR7i6ohz7dRqp5tQ5jfEYbq",
      standardContractType: "LitAction",
      chain: "ethereum",
      method: "go",
      parameters: [],
      returnValueTest: {
        comparator: "=",
        value: "true",
      },
    },
  ];

  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
    {
      accessControlConditions,
      authSig,
      chain: "ethereum",
      dataToEncrypt: "the answer to life, the universe, and everything is 42",
    },
    client
  );

  const decryptedString = await LitJsSdk.decryptToString(
    {
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      authSig: await getCapacityDelegationAuthSig(),
      chain: "ethereum",
    },
    client
  );
  console.log("decryptedString", decryptedString);
})();

async function getAuthSig() {
  const wallet = getWallet();
  const address = ethers.getAddress(await wallet.getAddress());
  const messageToSign = (await getSiweMessage(address)).prepareMessage();
  const signature = await wallet.signMessage(messageToSign);

  return {
    sig: signature,
    derivedVia: "web3.eth.personal.sign",
    signedMessage: messageToSign,
    address,
  };
}

function getPrivateKey() {
  if (process.env.PRIVATE_KEY === undefined)
    throw new Error("Please provide the env: PRIVATE_KEY");
  return process.env.PRIVATE_KEY;
}

function getWallet() {
  return new ethers.Wallet(getPrivateKey());
}

async function getSiweMessage(address) {
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
    nonce: await litNodeClient.getLatestBlockhash(),
    expirationTime,
  });
}

async function getCapacityDelegationAuthSig() {
  const contractClient = new LitContracts({
    privateKey: getPrivateKey(),
    network: "habanero",
  });
  await contractClient.connect();

  const { capacityDelegationAuthSig } =
    await client.createCapacityDelegationAuthSig({
      dAppOwnerWallet: getWallet(),
      capacityTokenId: "1073",
    });
  return capacityDelegationAuthSig;
}
