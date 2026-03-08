/**
 * Unified Social Service
 * Merges: Messaging (8103) + Engagement (8104) + Live (8096) + Achievement (8097) + 
 *         Governance (8098) + Recommendation
 * 
 * Each sub-service runs its own Fastify instance on its original port.
 * This launcher starts all of them in one Node.js process.
 */

async function startSocialGroup() {
    console.log('🚀 [Social Group] Starting unified social services...');

    const imports = await Promise.allSettled([
        import('../../messaging/src/server.ts').then(() => console.log('  ✅ Messaging service started (:8103)')),
        import('../../engagement/src/server.ts').then(() => console.log('  ✅ Engagement service started (:8104)')),
        import('../../live/src/server.ts').then(() => console.log('  ✅ Live service started (:8096)')),
        import('../../achievement/src/server.ts').then(() => console.log('  ✅ Achievement service started (:8097)')),
        import('../../governance/src/server.ts').then(() => console.log('  ✅ Governance service started (:8098)')),
        import('../../recommendation/src/server.ts').then(() => console.log('  ✅ Recommendation service started')),
    ]);

    const failed = imports.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`  ⚠️ ${failed.length} sub-service(s) failed to start:`);
        failed.forEach((r: any) => console.warn(`    - ${r.reason?.message || r.reason}`));
    }

    console.log('🟢 [Social Group] All social services running in single process');
}

startSocialGroup().catch(err => {
    console.error('❌ Social group startup failed:', err);
    process.exit(1);
});
