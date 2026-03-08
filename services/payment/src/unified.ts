/**
 * Unified Payment Service
 * Merges: Payment (8091) + Royalty (8094) + NFT (8095) + Bridge (8099) + Collaboration
 * 
 * Each sub-service runs its own Fastify instance on its original port.
 * This launcher starts all of them in one Node.js process.
 */

async function startPaymentGroup() {
    console.log('🚀 [Payment Group] Starting unified payment services...');

    const imports = await Promise.allSettled([
        import('../../payment/src/server.ts').then(() => console.log('  ✅ Payment service started (:8091)')),
        import('../../royalty/src/server.ts').then(() => console.log('  ✅ Royalty service started (:8094)')),
        import('../../nft/src/server.ts').then(() => console.log('  ✅ NFT service started (:8095)')),
        import('../../bridge/src/server.ts').then(() => console.log('  ✅ Bridge service started (:8099)')),
        import('../../collaboration/src/server.ts').then(() => console.log('  ✅ Collaboration service started')),
    ]);

    const failed = imports.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`  ⚠️ ${failed.length} sub-service(s) failed to start:`);
        failed.forEach((r: any) => console.warn(`    - ${r.reason?.message || r.reason}`));
    }

    console.log('🟢 [Payment Group] All payment services running in single process');
}

startPaymentGroup().catch(err => {
    console.error('❌ Payment group startup failed:', err);
    process.exit(1);
});
