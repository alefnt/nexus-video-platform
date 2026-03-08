/**
 * Unified Content Service
 * Merges: Content (8092) + Metadata (8093) + Search (8101) + Transcode (8100) + Moderation (8102)
 * 
 * Strategy: Each sub-service still runs its own Fastify instance on its original port.
 * This launcher starts all of them in one process, reducing the number of Node.js processes
 * from 5 to 1, while keeping API routes unchanged.
 */

async function startContentGroup() {
    console.log('🚀 [Content Group] Starting unified content services...');

    // Import each sub-service (they self-register routes and listen on their own ports)
    const imports = await Promise.allSettled([
        import('../../content/src/server.ts').then(() => console.log('  ✅ Content service started (:8092)')),
        import('../../metadata/src/server.ts').then(() => console.log('  ✅ Metadata service started (:8093)')),
        import('../../search/src/server.ts').then(() => console.log('  ✅ Search service started (:8101)')),
        import('../../transcode/src/server.ts').then(() => console.log('  ✅ Transcode service started (:8100)')),
        import('../../moderation/src/server.ts').then(() => console.log('  ✅ Moderation service started (:8102)')),
    ]);

    const failed = imports.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
        console.warn(`  ⚠️ ${failed.length} sub-service(s) failed to start:`);
        failed.forEach((r: any) => console.warn(`    - ${r.reason?.message || r.reason}`));
    }

    console.log('🟢 [Content Group] All content services running in single process');
}

startContentGroup().catch(err => {
    console.error('❌ Content group startup failed:', err);
    process.exit(1);
});
