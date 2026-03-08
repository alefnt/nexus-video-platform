/**
 * Content Seed Script
 * Populates the database with music and article content via /metadata/write API.
 * 
 * Usage:
 *   1. Start the services: npm run dev:services
 *   2. Login via browser to get a JWT token
 *   3. Run: npx tsx scripts/seed-content.ts <JWT_TOKEN>
 * 
 * OR set environment variable:
 *   SEED_JWT=<token> npx tsx scripts/seed-content.ts
 */

const API_BASE = process.env.API_BASE || "http://localhost:8080";
const JWT = process.argv[2] || process.env.SEED_JWT || "";

if (!JWT) {
    console.log(`
╔══════════════════════════════════════════════════╗
║  Content Seed Script                             ║
║  Usage:                                          ║
║  npx tsx scripts/seed-content.ts <JWT_TOKEN>     ║
╚══════════════════════════════════════════════════╝

To get a JWT token:
1. Login via the browser at http://localhost:5173/login
2. Open DevTools → Application → Session Storage → vp.jwt
3. Copy the token value
`);
}

// 4 Test Creators for settlement / split verification
const CREATORS = [
    {
        bitDomain: "alice-creator.bit",
        ckbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0001",
    },
    {
        bitDomain: "bob-studio.bit",
        ckbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0002",
    },
    {
        bitDomain: "charlie-media.bit",
        ckbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0003",
    },
    {
        bitDomain: "nexus-creator.bit",
        ckbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga",
    },
];

// Only verified, playable music tracks (unique CDN URLs)
const MUSIC_TRACKS = [
    {
        id: "seed-music-001",
        contentType: "audio" as const,
        title: "I Want To Destroy Something Beautiful",
        description: "An indie rock masterpiece by Josh Woodward. Creative Commons licensed.",
        genre: "Rock",
        tags: ["indie", "rock", "cc"],
        priceUSDI: "5",
        priceMode: "both" as const,
        pointsPrice: 50,
        buyOncePrice: 50,
        streamPricePerMinute: 1,
        durationSeconds: 200,
        cdnUrl: "https://www.joshwoodward.com/mp3/JoshWoodward-IWantToDestroySomethingBeautiful.mp3",
        posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
        creator: CREATORS[0], // alice
    },
    {
        id: "seed-music-002",
        contentType: "audio" as const,
        title: "Elisions",
        description: "Lo-fi ambient piece by Chad Crouch. Perfect for study sessions.",
        genre: "Lo-Fi",
        tags: ["lofi", "ambient", "study"],
        priceUSDI: "3",
        priceMode: "both" as const,
        pointsPrice: 30,
        buyOncePrice: 30,
        streamPricePerMinute: 1,
        durationSeconds: 240,
        cdnUrl: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Elisions.mp3",
        posterUrl: "https://images.unsplash.com/photo-1514525253440-b393452e8d2e?w=400&q=80",
        creator: CREATORS[1], // bob
    },
    {
        id: "seed-music-003",
        contentType: "audio" as const,
        title: "Impact Moderato",
        description: "Cinematic orchestral track by Kevin MacLeod. Royalty free.",
        genre: "Classical",
        tags: ["orchestral", "cinematic", "royalty-free"],
        priceUSDI: "8",
        priceMode: "both" as const,
        pointsPrice: 80,
        buyOncePrice: 80,
        streamPricePerMinute: 2,
        durationSeconds: 180,
        cdnUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
        posterUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80",
        creator: CREATORS[2], // charlie
    },
];

const ARTICLES = [
    {
        id: "seed-article-001",
        contentType: "article" as const,
        title: "The Future of Decentralized Content",
        description: "Exploring how blockchain technology is reshaping content creation, distribution, and monetization in the digital age.",
        genre: "Technology",
        tags: ["blockchain", "web3", "content"],
        priceUSDI: "2",
        priceMode: "both" as const,
        pointsPrice: 20,
        buyOncePrice: 20,
        streamPricePerMinute: 1,
        durationSeconds: 600,
        posterUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80",
        creator: CREATORS[3], // nexus
        textContent: `The landscape of digital content is undergoing a revolutionary transformation. With the advent of blockchain technology, creators finally have the tools to take ownership of their work and build direct relationships with their audiences.\n\n## The Problem with Centralized Platforms\n\nTraditional content platforms act as intermediaries, taking significant cuts of creator revenue (often 30-45%) while controlling the algorithms that determine visibility. Creators have little say in how their content is distributed or monetized.\n\n## Enter Web3\n\nDecentralized platforms like Nexus represent a new paradigm:\n\n- **Direct Monetization**: Creators set their own prices using smart contracts\n- **Transparent Revenue**: All transactions are recorded on-chain\n- **True Ownership**: Content is stored on decentralized networks (IPFS, Filecoin, Arweave)\n- **Community Governance**: Token holders participate in platform decisions\n\n## The Technology Stack\n\nNexus leverages several cutting-edge technologies:\n\n1. **CKB (Nervos Network)** - Layer 1 blockchain for security and ownership\n2. **Fiber Network** - Layer 2 for instant micropayments\n3. **Spore Protocol** - NFT standard for content ownership certificates\n4. **JoyID** - Passwordless authentication via passkeys\n\n## Looking Forward\n\nThe future of content is decentralized, transparent, and creator-first. As these technologies mature, we expect to see a fundamental shift in how content is created, shared, and valued.`,
    },
    {
        id: "seed-article-002",
        contentType: "article" as const,
        title: "Understanding CKB: A Developer's Guide",
        description: "A comprehensive introduction to Nervos CKB blockchain for developers new to the ecosystem.",
        genre: "Education",
        tags: ["ckb", "nervos", "developer", "guide"],
        priceUSDI: "5",
        priceMode: "both" as const,
        pointsPrice: 50,
        buyOncePrice: 50,
        streamPricePerMinute: 1,
        durationSeconds: 900,
        posterUrl: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80",
        creator: CREATORS[0], // alice
        textContent: `# Understanding CKB: A Developer's Guide\n\nNervos CKB (Common Knowledge Base) is a novel blockchain design that introduces the Cell Model, a generalized UTXO model that provides unprecedented flexibility for smart contract development.\n\n## The Cell Model\n\nUnlike Ethereum's account model, CKB uses Cells — independent units that hold data and are controlled by lock scripts. This design enables:\n\n- **Parallel transaction processing**\n- **Predictable state costs**\n- **Flexible ownership models**\n\n## Key Concepts\n\n### 1. Lock Scripts\nLock scripts define who can modify a cell. Think of them as access control rules written in any language that compiles to RISC-V.\n\n### 2. Type Scripts\nType scripts define the rules for how a cell's data can transform. They enable smart contract logic without the complexity of Ethereum's EVM.\n\n### 3. CKBytes\nThe native token serves dual purpose: it's both a value transfer medium and a unit of on-chain storage. 1 CKByte = 1 byte of on-chain storage.\n\n## Getting Started\n\nTo start developing on CKB, you'll need:\n1. A CKB node or testnet access\n2. The CKB SDK (available in Rust, JavaScript, and Go)\n3. A JoyID wallet for testing\n\nVisit the Nervos documentation at docs.nervos.org for detailed tutorials.`,
    },
    {
        id: "seed-article-003",
        contentType: "article" as const,
        title: "Stream Payments: The Netflix of Web3",
        description: "How per-second micropayments are changing the way we consume and pay for digital content.",
        genre: "Crypto & Web3",
        tags: ["payments", "streaming", "micropayments", "fiber"],
        priceUSDI: "3",
        priceMode: "both" as const,
        pointsPrice: 30,
        buyOncePrice: 30,
        streamPricePerMinute: 1,
        durationSeconds: 480,
        posterUrl: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&q=80",
        creator: CREATORS[1], // bob
        textContent: `# Stream Payments: The Netflix of Web3\n\nImagine paying only for the exact minutes you watch a video, or the exact chapters you read in a book. Stream payments make this possible.\n\n## How It Works\n\nUsing the Fiber Network (CKB's Layer 2), payments can be processed in real-time:\n\n1. **Open a payment channel** between viewer and creator\n2. **Stream micropayments** every second/minute of consumption\n3. **Close the channel** when done, settling on-chain\n\n## Benefits\n\n- **No subscriptions** — Pay only for what you use\n- **Instant settlement** — Creators get paid in real-time\n- **No middlemen** — Direct peer-to-peer payments\n- **Micro-amounts** — Pay fractions of a cent per second\n\n## Real-World Impact\n\nStream payments enable entirely new business models:\n- Musicians get paid per listen\n- Writers get paid per chapter\n- Video creators get paid per view minute\n- Live streamers get paid per second of watch time\n\nThis is not just an incremental improvement — it's a fundamental rethinking of how digital content is valued and compensated.`,
    },
    {
        id: "seed-article-004",
        contentType: "article" as const,
        title: "NFTs and Digital Ownership with Spore Protocol",
        description: "How Spore Protocol on CKB enables true digital ownership through on-chain content NFTs.",
        genre: "Crypto & Web3",
        tags: ["nft", "spore", "ownership", "ckb"],
        priceUSDI: "10",
        priceMode: "both" as const,
        pointsPrice: 100,
        buyOncePrice: 100,
        streamPricePerMinute: 2,
        durationSeconds: 720,
        posterUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
        creator: CREATORS[2], // charlie
        textContent: `# NFTs and Digital Ownership with Spore Protocol\n\nSpore Protocol is a next-generation NFT standard built on CKB that addresses many limitations of existing NFT standards like ERC-721.\n\n## What Makes Spore Different?\n\n### 1. On-Chain Content\nUnlike most NFTs that store only a URL pointing to off-chain content, Spore stores the actual content on-chain. The content is permanent and verifiable.\n\n### 2. Clusters\nSpore introduces Clusters — groups of related Spores that share properties. For a video platform, a Cluster might represent:\n- All episodes of a series\n- A creator's entire catalog\n- Access passes to premium content\n\n### 3. Mutant Spores\nSpores can be designed to evolve over time based on on-chain conditions. Imagine an NFT that changes based on how many times the content has been viewed.\n\n## Use Cases on Nexus\n\n1. **Content Ownership Certificates** — When you create content, a Spore is minted proving your authorship\n2. **Access Passes** — Limited edition passes that grant access to premium content\n3. **Revenue Splits** — Smart contracts automatically distribute earnings among collaborators\n\n## Getting Started\n\nTo create your first Spore, connect your JoyID wallet and navigate to the NFT Marketplace.`,
    },
    {
        id: "seed-article-005",
        contentType: "article" as const,
        title: "Building a Creator Economy on Blockchain",
        description: "A vision for how decentralized platforms can empower creators with fair compensation and true ownership.",
        genre: "Vlogs",
        tags: ["creator-economy", "blockchain", "empowerment"],
        priceUSDI: "2",
        priceMode: "both" as const,
        pointsPrice: 20,
        buyOncePrice: 20,
        streamPricePerMinute: 1,
        durationSeconds: 540,
        posterUrl: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&q=80",
        creator: CREATORS[3], // nexus
        textContent: `# Building a Creator Economy on Blockchain\n\nThe creator economy is worth over $100 billion, yet most creators earn less than minimum wage. Blockchain technology offers a path to fix this fundamental imbalance.\n\n## The Current State\n\n- YouTube takes 45% of ad revenue\n- Spotify pays $0.003-0.005 per stream\n- Most platforms own your audience data\n- Algorithms control your visibility\n\n## The Blockchain Alternative\n\n### Direct Monetization\nCreators set their own prices. No platform cut. No algorithm gatekeeping.\n\n### Multiple Revenue Streams\n- **One-time purchases** for premium content\n- **Stream payments** for pay-per-view\n- **NFT sales** for exclusive collectibles\n- **Tips and donations** from fans\n- **Revenue splits** with collaborators\n\n### True Ownership\n- Your content lives on decentralized storage\n- Your audience relationships are yours\n- Your reputation is portable across platforms\n\n## Join the Revolution\n\nStart creating on Nexus today. Upload your first piece of content, set your price, and begin earning directly from your audience. No middlemen, no algorithms — just you and your fans.`,
    },
];

async function seed() {
    if (!JWT) {
        console.log("⚠️  No JWT provided. Skipping database seeding.");
        console.log("   The application will still work with client-side fallback data.");
        return;
    }

    console.log("🌱 Seeding content data...\n");

    const allContent = [...MUSIC_TRACKS, ...ARTICLES];
    let success = 0;
    let failed = 0;

    for (const item of allContent) {
        const creator = (item as any).creator || CREATORS[0];
        const { creator: _c, ...rest } = item as any;

        const meta = {
            ...rest,
            creatorBitDomain: creator.bitDomain,
            creatorCkbAddress: creator.ckbAddress,
            createdAt: new Date().toISOString(),
        };

        try {
            const res = await fetch(`${API_BASE}/metadata/write`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${JWT}`,
                },
                body: JSON.stringify({ meta }),
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`  ✅ ${item.contentType}: ${item.title} (${item.id}) → ${creator.bitDomain}`);
                success++;
            } else {
                const err = await res.text();
                console.log(`  ❌ ${item.title}: ${res.status} ${err}`);
                failed++;
            }
        } catch (e: any) {
            console.log(`  ❌ ${item.title}: ${e.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Seeding complete: ${success} succeeded, ${failed} failed`);
    console.log(`\n📊 Creator Distribution:`);
    for (const c of CREATORS) {
        const count = allContent.filter((i: any) => i.creator?.bitDomain === c.bitDomain).length;
        if (count > 0) console.log(`   ${c.bitDomain}: ${count} items`);
    }
}

seed();
