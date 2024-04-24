import {
  Keypair,
  Contract,
  SorobanRpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  TimeoutInfinite,
} from "@stellar/stellar-sdk";

const go = async () => {
  try {
    const sourceKeypair = Keypair.fromSecret(
      "SCQN3XGRO65BHNSWLSHYIR4B65AHLDUQ7YLHGIWQ4677AZFRS77TCZRB"
    );

    const server = new SorobanRpc.Server(
      "https://soroban-testnet.stellar.org:443"
    );

    const contractAddress =
      "CDBYJCHUJSPHHRIKGJSUEMV4XELXQFZE6HOBW5CIB4EDVZPKPRJKFIAN";
    const contract = new Contract(contractAddress);

    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());

    // The transaction begins as pretty standard. The source account, minimum
    // fee, and network passphrase are provided.
    let builtTransaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("always_true"))
      .setTimeout(TimeoutInfinite)
      .build();

    let preparedTransaction = await server.prepareTransaction(builtTransaction);
    preparedTransaction.sign(sourceKeypair);

    console.log(preparedTransaction.toXDR());
  } catch (e) {
    console.log(e);
  }
  return false;
};

go();
