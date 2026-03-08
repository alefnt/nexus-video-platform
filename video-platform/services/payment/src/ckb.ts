
import { Indexer, helpers, RPC, config, hd } from "@ckb-lumos/lumos";

// Initialize Config
config.initializeConfig(config.predefined.AGGRON4);

const CKB_NODE_URL = process.env.CKB_NODE_URL || "https://testnet.ckb.dev/rpc";
const CKB_INDEXER_URL = process.env.CKB_INDEXER_URL || "https://testnet.ckb.dev/indexer";

const rpc = new RPC(CKB_NODE_URL);
const indexer = new Indexer(CKB_INDEXER_URL, CKB_NODE_URL);

/**
 * Send CKB using Lumos
 */
export async function sendCkb(privateKey: string, toAddress: string, amountCKB: number): Promise<string> {
    // Dynamic import to prevent startup crash if package is missing
    let common;
    try {
        // Try importing common-scripts
        // @ts-ignore
        common = await import("@ckb-lumos/common-scripts").then(m => m.common);
    } catch (e) {
        console.warn("[CKB] @ckb-lumos/common-scripts not found. Real transfers unavailable.");
        throw new Error("Missing dependency @ckb-lumos/common-scripts for real transfer.");
    }

    if (!common) throw new Error("Common scripts not loaded.");

    // 1. Derive Address (using non-deprecated encodeToAddress with explicit script)
    const pubKey = hd.key.privateKeyToBlake160(privateKey);
    const SECP256K1_CODE_HASH = config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160!.CODE_HASH;
    const SECP256K1_HASH_TYPE = config.predefined.AGGRON4.SCRIPTS.SECP256K1_BLAKE160!.HASH_TYPE;
    const fromAddress = helpers.encodeToAddress({
        codeHash: SECP256K1_CODE_HASH,
        hashType: SECP256K1_HASH_TYPE,
        args: pubKey,
    });

    console.log(`[CKB] Preparing transfer: ${amountCKB} CKB from ${fromAddress} -> ${toAddress}`);

    // 2. Init Skeleton
    let txSkeleton = helpers.TransactionSkeleton({ cellProvider: indexer });
    const amountShannons = BigInt(amountCKB * 100000000);

    // 3. Transfer & Fee
    txSkeleton = await common.transfer(
        txSkeleton,
        [fromAddress],
        toAddress,
        amountShannons
    );

    txSkeleton = await common.payFeeByFeeRate(
        txSkeleton,
        [fromAddress],
        1000
    );

    // 4. Sign
    txSkeleton = common.prepareSigningEntries(txSkeleton);
    const message = txSkeleton.get("signingEntries").get(0)!.message;

    // Sign
    const Sig = hd.key.signRecoverable(message!, privateKey);
    const tx = helpers.sealTransaction(txSkeleton, [Sig]);

    // 5. Send
    const txHash = await rpc.sendTransaction(tx, "passthrough");
    console.log(`[CKB] Transfer sent: ${txHash}`);

    return txHash;
}
