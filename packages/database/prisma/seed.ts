import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // ──────────────────────────────────────────────
  // 1. USERS — 5 different creators + 1 viewer
  // ──────────────────────────────────────────────
  const creators = [
    {
      id: 'seed-user-creator-0001',
      email: 'creator@demo.nexus',
      username: 'nexus_creator',
      nickname: 'Nexus Creator',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=creator',
      bio: 'Official demo creator — tech tutorials & blockchain education',
      role: 'creator',
      points: 10000,
      address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga',
    },
    {
      id: 'seed-user-creator-alice',
      email: 'alice@demo.nexus',
      username: 'alice_creative',
      nickname: 'Alice Creative',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alice',
      bio: 'Filmmaker & visual storyteller. I make cinematic travel videos & food content.',
      role: 'creator',
      points: 8000,
      address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0001',
    },
    {
      id: 'seed-user-creator-bob',
      email: 'bob@demo.nexus',
      username: 'bob_studio',
      nickname: 'Bob Studio',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bob',
      bio: 'Music producer & DJ. Lo-fi, electronic, ambient. Every beat tells a story.',
      role: 'creator',
      points: 6000,
      address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0002',
    },
    {
      id: 'seed-user-creator-charlie',
      email: 'charlie@demo.nexus',
      username: 'charlie_writes',
      nickname: 'Charlie Writes',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=charlie',
      bio: 'Writer, essayist, and blockchain journalist. Exploring Web3, crypto, and the future of content.',
      role: 'creator',
      points: 7500,
      address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0003',
    },
    {
      id: 'seed-user-creator-diana',
      email: 'diana@demo.nexus',
      username: 'diana_arts',
      nickname: 'Diana Arts',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=diana',
      bio: 'Digital artist & classical musician. NFT enthusiast. Art is my blockchain.',
      role: 'creator',
      points: 5500,
      address: 'ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0004',
    },
  ];

  for (const c of creators) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: { address: c.address, nickname: c.nickname, avatar: c.avatar, bio: c.bio, points: c.points },
      create: c,
    });
  }

  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@demo.nexus' },
    update: {},
    create: {
      id: 'seed-user-viewer-0002',
      email: 'viewer@demo.nexus',
      username: 'nexus_viewer',
      nickname: 'Nexus Viewer',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer',
      bio: 'Official demo viewer account',
      role: 'viewer',
      points: 500,
    },
  });

  console.log(`  Users: ${creators.length} creators + 1 viewer`);

  // ──────────────────────────────────────────────
  // 2. VIDEOS — 15 diverse entries across 5 creators
  // ──────────────────────────────────────────────
  const videoDefs = [
    // === Nexus Creator (Tech) ===
    {
      id: 'seed-video-001', title: 'Introduction to Decentralized Video Streaming',
      description: 'A comprehensive overview of how decentralized video platforms work, covering IPFS storage, content-addressed media, and peer-to-peer delivery.',
      contentType: 'video', genre: 'Tech', tags: ['web3', 'decentralized', 'streaming', 'tutorial'],
      duration: 1245, views: 12450, likes: 892, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      creatorIdx: 0,
    },
    {
      id: 'seed-video-002', title: 'Building Smart Contracts on Nervos CKB',
      description: 'Step-by-step tutorial on writing, testing, and deploying smart contracts using the RISC-V based CKB-VM.',
      contentType: 'video', genre: 'Tech', tags: ['nervos', 'ckb', 'smart-contracts', 'blockchain'],
      duration: 2340, views: 8720, likes: 654, priceMode: 'buy_once', priceUSDI: '5', pointsPrice: 200,
      coverUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      creatorIdx: 0,
    },
    {
      id: 'seed-video-006', title: 'The Future of Digital Identity with DIDs',
      description: 'Exploring decentralized identifiers, self-sovereign identity, and how JoyID and .bit are changing digital ownership.',
      contentType: 'video', genre: 'Tech', tags: ['did', 'identity', 'web3', 'privacy'],
      duration: 1830, views: 9870, likes: 720, priceMode: 'stream', priceUSDI: '0', streamPricePerMinute: 1,
      coverUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
      creatorIdx: 0,
    },
    {
      id: 'seed-video-010', title: 'Lightning Network Payment Channels Explained',
      description: 'Deep dive into how payment channels work on the Lightning Network and Fiber Network, with live demos.',
      contentType: 'video', genre: 'Tech', tags: ['lightning', 'fiber', 'payments', 'layer2'],
      duration: 2100, views: 11300, likes: 890, priceMode: 'both', priceUSDI: '4', pointsPrice: 180, streamPricePerMinute: 3,
      coverUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
      creatorIdx: 0,
    },
    // === Alice (Food & Travel) ===
    {
      id: 'seed-video-005', title: 'Cooking Authentic Sichuan Mapo Tofu',
      description: 'Follow along as we prepare authentic Sichuan-style mapo tofu from scratch using doubanjiang, Sichuan peppercorns.',
      contentType: 'video', genre: 'Food', tags: ['cooking', 'chinese', 'sichuan', 'recipe'],
      duration: 960, views: 45600, likes: 3200, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      creatorIdx: 1,
    },
    {
      id: 'seed-video-009', title: 'Tokyo Night Walk - Cinematic 4K',
      description: 'A mesmerizing night walk through the neon-lit streets of Shinjuku and Shibuya in Tokyo.',
      contentType: 'video', genre: 'Travel', tags: ['tokyo', 'japan', 'cinematic', '4k', 'nightwalk'],
      duration: 5400, views: 234000, likes: 18700, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
      creatorIdx: 1,
    },
    {
      id: 'seed-video-011', title: 'Hidden Gems of Seoul Street Food',
      description: 'Exploring the bustling night markets of Seoul — from tteokbokki to hotteok. A foodie\'s dream journey.',
      contentType: 'video', genre: 'Food', tags: ['seoul', 'korea', 'streetfood', 'travel'],
      duration: 1400, views: 67800, likes: 5100, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      creatorIdx: 1,
    },
    // === Bob (Music & Lifestyle) ===
    {
      id: 'seed-video-003', title: 'Lo-Fi Beats to Code To - 2 Hour Mix',
      description: 'Relaxing lo-fi hip hop beats perfect for coding sessions. Vinyl crackle, ambient rain sounds.',
      contentType: 'video', genre: 'Music', tags: ['lofi', 'chill', 'coding', 'ambient'],
      duration: 7200, views: 156000, likes: 12400, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1494232410401-ad00d5433cfa?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      creatorIdx: 2,
    },
    {
      id: 'seed-video-012', title: 'How I Produce Music with AI Tools',
      description: 'Walkthrough of my production workflow using Suno, Udio, and Ableton. Tips on AI-assisted music creation.',
      contentType: 'video', genre: 'Music', tags: ['music-production', 'ai', 'tutorial', 'ableton'],
      duration: 2400, views: 34200, likes: 2890, priceMode: 'buy_once', priceUSDI: '3', pointsPrice: 120,
      coverUrl: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      creatorIdx: 2,
    },
    {
      id: 'seed-video-007', title: 'Morning Yoga Flow for Developers',
      description: 'A gentle 20-minute morning yoga routine for people who sit at desks all day.',
      contentType: 'video', genre: 'Health', tags: ['yoga', 'fitness', 'wellness', 'developer'],
      duration: 1200, views: 67800, likes: 5430, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      creatorIdx: 2,
    },
    // === Charlie (Education & Knowledge) ===
    {
      id: 'seed-video-013', title: 'Bitcoin Explained: From Genesis Block to Now',
      description: 'Comprehensive history of Bitcoin — Satoshi\'s whitepaper, the cypherpunk movement, halvings, ETFs.',
      contentType: 'video', genre: 'Education', tags: ['bitcoin', 'history', 'crypto', 'education'],
      duration: 3600, views: 89000, likes: 7200, priceMode: 'free', priceUSDI: '0',
      coverUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      creatorIdx: 3,
    },
    {
      id: 'seed-video-014', title: 'Zero Knowledge Proofs for Beginners',
      description: 'What are ZK proofs? Why do they matter? Visual explanations of ZK-SNARKs and ZK-STARKs.',
      contentType: 'video', genre: 'Education', tags: ['zk-proofs', 'privacy', 'crypto', 'advanced'],
      duration: 2700, views: 15600, likes: 1340, priceMode: 'both', priceUSDI: '6', pointsPrice: 250, streamPricePerMinute: 2,
      coverUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      creatorIdx: 3,
    },
    // === Diana (Art & Creative) ===
    {
      id: 'seed-video-004', title: 'Urban Street Photography Masterclass',
      description: 'Learn the art of capturing compelling street photography. Composition, lighting, and storytelling.',
      contentType: 'video', genre: 'Art', tags: ['photography', 'street', 'masterclass', 'urban'],
      duration: 3600, views: 24300, likes: 1870, priceMode: 'both', priceUSDI: '3', pointsPrice: 150, streamPricePerMinute: 2,
      coverUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      creatorIdx: 4,
    },
    {
      id: 'seed-video-008', title: 'NFT Art Creation: From Sketch to Mint',
      description: 'Watch the full creative process of designing a generative NFT collection on Spore Protocol.',
      contentType: 'video', genre: 'Art', tags: ['nft', 'digital-art', 'spore', 'generative'],
      duration: 2700, views: 18200, likes: 1340, priceMode: 'buy_once', priceUSDI: '8', pointsPrice: 350,
      coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
      creatorIdx: 4,
    },
    {
      id: 'seed-video-015', title: 'Generative Art with p5.js — Live Coding',
      description: 'Watch me code generative art live using p5.js. Fractals, particle systems, and random color palettes.',
      contentType: 'video', genre: 'Art', tags: ['generative-art', 'p5js', 'creative-coding', 'live'],
      duration: 1800, views: 21000, likes: 1780, priceMode: 'stream', priceUSDI: '0', streamPricePerMinute: 1,
      coverUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80',
      videoUrl: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
      creatorIdx: 4,
    },
  ];

  for (const v of videoDefs) {
    const c = creators[v.creatorIdx];
    await prisma.video.upsert({
      where: { id: v.id },
      update: {
        title: v.title, description: v.description, contentType: v.contentType,
        genre: v.genre, tags: v.tags, duration: v.duration, views: v.views, likes: v.likes,
        priceMode: v.priceMode, priceUSDI: v.priceUSDI,
        pointsPrice: (v as any).pointsPrice ?? null,
        streamPricePerMinute: (v as any).streamPricePerMinute ?? 0,
        coverUrl: v.coverUrl, videoUrl: v.videoUrl,
        creatorCkbAddress: c.address,
      },
      create: {
        id: v.id,
        title: v.title, description: v.description, contentType: v.contentType,
        genre: v.genre, tags: v.tags, duration: v.duration, views: v.views, likes: v.likes,
        priceMode: v.priceMode, priceUSDI: v.priceUSDI,
        pointsPrice: (v as any).pointsPrice ?? null,
        streamPricePerMinute: (v as any).streamPricePerMinute ?? 0,
        coverUrl: v.coverUrl, videoUrl: v.videoUrl,
        creatorId: c.id,
        creatorCkbAddress: c.address,
      },
    });
  }
  console.log(`  Videos: ${videoDefs.length} seeded across ${new Set(videoDefs.map(v => v.creatorIdx)).size} creators`);

  // ──────────────────────────────────────────────
  // 3. ARTICLES — 8 articles across 4 creators
  // ──────────────────────────────────────────────
  const articleDefs = [
    // === Charlie (public domain classics + blockchain essays) ===
    {
      id: 'seed-article-001', title: 'Frankenstein',
      summary: 'Mary Shelley — The story of Victor Frankenstein and his monstrous creation.',
      genre: 'Sci-Fi', tags: ['classic', 'gothic', 'horror', 'public-domain'],
      coverUrl: 'https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg',
      views: 854300, likes: 42100, creatorIdx: 3,
      content: `# Frankenstein; or, The Modern Prometheus\n\n## Letter 1 — To Mrs. Saville, England\n\nSt. Petersburgh, Dec. 11th, 17—\n\nYou will rejoice to hear that no disaster has accompanied the commencement of an enterprise which you have regarded with such evil forebodings. I arrived here yesterday, and my first task is to assure my dear sister of my welfare and increasing confidence in the success of my undertaking.\n\nI am already far north of London, and as I walk in the streets of Petersburgh, I feel a cold northern breeze play upon my cheeks, which braces my nerves and fills me with delight.\n\n## Chapter 1\n\nI am by birth a Genevese, and my family is one of the most distinguished of that republic. My ancestors had been for many years counsellors and syndics, and my father had filled several public situations with honour and reputation.`,
    },
    {
      id: 'seed-article-002', title: "Alice's Adventures in Wonderland",
      summary: 'Lewis Carroll — Alice falls down a rabbit hole into a fantasy world.',
      genre: 'Fantasy', tags: ['classic', 'fantasy', 'children', 'public-domain'],
      coverUrl: 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
      views: 1240500, likes: 67200, creatorIdx: 3,
      content: `# Alice's Adventures in Wonderland\n\n## Chapter I — Down the Rabbit-Hole\n\nAlice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, "and what is the use of a book," thought Alice "without pictures or conversations?"\n\nSo she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.`,
    },
    {
      id: 'seed-article-003', title: 'Pride and Prejudice',
      summary: 'Jane Austen — A romantic novel of manners following Elizabeth Bennet.',
      genre: 'Romance', tags: ['classic', 'romance', 'regency', 'public-domain'],
      coverUrl: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
      views: 3500000, likes: 185000, creatorIdx: 4,
      content: `# Pride and Prejudice\n\n## Chapter 1\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n\n"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"`,
    },
    {
      id: 'seed-article-004', title: 'The Adventures of Sherlock Holmes',
      summary: 'Arthur Conan Doyle — Twelve short stories featuring the legendary detective.',
      genre: 'Mystery', tags: ['classic', 'mystery', 'detective', 'public-domain'],
      coverUrl: 'https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg',
      views: 4200000, likes: 210000, creatorIdx: 0,
      content: `# The Adventures of Sherlock Holmes\n\n## A Scandal in Bohemia\n\nTo Sherlock Holmes she is always the woman. I have seldom heard him mention her under any other name. In his eyes she eclipses and predominates the whole of her sex.\n\nHe was, I take it, the most perfect reasoning and observing machine that the world has seen, but as a lover he would have placed himself in a false position.`,
    },
    {
      id: 'seed-article-005', title: 'The Adventures of Tom Sawyer',
      summary: 'Mark Twain — A young boy growing up along the Mississippi River.',
      genre: 'Adventure', tags: ['classic', 'adventure', 'coming-of-age', 'public-domain'],
      coverUrl: 'https://www.gutenberg.org/cache/epub/74/pg74.cover.medium.jpg',
      views: 2800000, likes: 134000, creatorIdx: 1,
      content: `# The Adventures of Tom Sawyer\n\n## Chapter I\n\n"TOM!"\n\nNo answer.\n\n"TOM!"\n\nNo answer.\n\n"What's gone with that boy, I wonder? You TOM!"\n\nNo answer. The old lady pulled her spectacles down and looked over them about the room; then she put them up and looked out under them.`,
    },
    // === Tech/Web3 articles (Charlie & Nexus Creator) ===
    {
      id: 'seed-article-006', title: 'The Future of Decentralized Content',
      summary: 'How blockchain technology is reshaping content creation and distribution in the digital age.',
      genre: 'Technology', tags: ['blockchain', 'web3', 'content', 'future'],
      coverUrl: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&q=80',
      views: 15600, likes: 890, creatorIdx: 0,
      content: `# The Future of Decentralized Content\n\nThe landscape of digital content is undergoing a revolutionary transformation. With blockchain technology, creators finally have tools to take ownership of their work.\n\n## The Problem with Centralized Platforms\n\nTraditional platforms act as intermediaries, taking 30-45% of creator revenue while controlling visibility algorithms.\n\n## Enter Web3\n\nDecentralized platforms like Nexus represent a new paradigm:\n\n- **Direct Monetization**: Creators set their own prices\n- **Transparent Revenue**: All transactions recorded on-chain\n- **True Ownership**: Content stored on Filecoin, Arweave\n- **Community Governance**: Token holders participate in decisions\n\n## The Technology Stack\n\n1. **CKB (Nervos Network)** — Layer 1 for security\n2. **Fiber Network** — Layer 2 for instant micropayments\n3. **Spore Protocol** — NFT standard for ownership\n4. **JoyID** — Passwordless authentication`,
    },
    {
      id: 'seed-article-007', title: 'Understanding CKB: A Developer Guide',
      summary: 'Introduction to Nervos CKB blockchain for developers new to the ecosystem.',
      genre: 'Education', tags: ['ckb', 'nervos', 'developer', 'guide'],
      coverUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&q=80',
      views: 8900, likes: 560, creatorIdx: 3,
      content: `# Understanding CKB: A Developer's Guide\n\nNervos CKB (Common Knowledge Base) introduces the Cell Model — a generalized UTXO model for unprecedented flexibility.\n\n## The Cell Model\n\nUnlike Ethereum's account model, CKB uses Cells — independent units that hold data:\n\n- **Parallel transaction processing**\n- **Predictable state costs**\n- **Flexible ownership models**\n\n## Key Concepts\n\n### Lock Scripts\nDefine who can modify a cell. Access control in any RISC-V language.\n\n### Type Scripts\nDefine how cell data can transform. Smart contract logic without EVM complexity.\n\n### CKBytes\nNative token: value transfer + on-chain storage (1 CKByte = 1 byte).`,
    },
    {
      id: 'seed-article-008', title: 'Stream Payments: The Netflix of Web3',
      summary: 'How per-second micropayments are changing the way we pay for digital content.',
      genre: 'Crypto & Web3', tags: ['payments', 'streaming', 'micropayments', 'fiber'],
      coverUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=400&q=80',
      views: 12300, likes: 780, creatorIdx: 2,
      content: `# Stream Payments: The Netflix of Web3\n\nImagine paying only for the exact seconds you watch. Stream payments make this possible.\n\n## How It Works\n\nUsing Fiber Network (CKB's Layer 2):\n\n1. **Open payment channel** between viewer and creator\n2. **Stream micropayments** every second\n3. **Close channel** when done, settle on-chain\n\n## Benefits\n\n- **No subscriptions** — Pay only for what you use\n- **Instant settlement** — Creators get paid in real-time\n- **No middlemen** — Direct P2P payments\n- **Micro-amounts** — Fractions of a cent per second`,
    },
  ];

  for (const a of articleDefs) {
    const c = creators[a.creatorIdx];
    await prisma.article.upsert({
      where: { id: a.id },
      update: {
        title: a.title, summary: a.summary, genre: a.genre, tags: a.tags,
        coverUrl: a.coverUrl, views: a.views, likes: a.likes, content: a.content,
      },
      create: {
        id: a.id, title: a.title, summary: a.summary, genre: a.genre, tags: a.tags,
        coverUrl: a.coverUrl, views: a.views, likes: a.likes, content: a.content,
        creatorId: c.id,
      },
    });
  }

  // Also seed article-type Videos so /metadata/list?type=article returns them
  for (const a of articleDefs) {
    const c = creators[a.creatorIdx];
    const videoId = a.id.replace('article', 'varticle');
    await prisma.video.upsert({
      where: { id: videoId },
      update: {
        title: a.title, description: a.summary, contentType: 'article',
        genre: a.genre, tags: a.tags, coverUrl: a.coverUrl,
        views: a.views, likes: a.likes, textContent: a.content,
        creatorCkbAddress: c.address,
      },
      create: {
        id: videoId, title: a.title, description: a.summary, contentType: 'article',
        genre: a.genre, tags: a.tags, coverUrl: a.coverUrl,
        views: a.views, likes: a.likes, textContent: a.content, videoUrl: '',
        priceMode: 'both', priceUSDI: '1', pointsPrice: 100, streamPricePerMinute: 2,
        creatorId: c.id, creatorCkbAddress: c.address,
      },
    });
  }
  console.log(`  Articles: ${articleDefs.length} seeded (Article + Video models) across ${new Set(articleDefs.map(a => a.creatorIdx)).size} creators`);

  // ──────────────────────────────────────────────
  // 4. MUSIC — 8 entries across 3 creators
  // ──────────────────────────────────────────────
  const musicDefs = [
    // === Bob (Producer) ===
    {
      id: 'seed-music-001', title: 'I Want To Destroy Something Beautiful',
      artist: 'Josh Woodward', album: 'The Wake', genre: 'Rock',
      tags: ['rock', 'indie', 'creative-commons'],
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      audioUrl: 'https://www.joshwoodward.com/mp3/JoshWoodward-IWantToDestroySomethingBeautiful.mp3',
      duration: 200, views: 34500, likes: 2100, creatorIdx: 2,
    },
    {
      id: 'seed-music-003', title: 'Elisions',
      artist: 'Chad Crouch', album: 'Arps', genre: 'Lo-Fi',
      tags: ['lofi', 'electronic', 'ambient', 'creative-commons'],
      coverUrl: 'https://images.unsplash.com/photo-1514525253440-b393452e8d2e?w=400&q=80',
      audioUrl: 'https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Elisions.mp3',
      duration: 240, views: 18200, likes: 1450, creatorIdx: 2,
    },
    {
      id: 'seed-music-006', title: 'Digital Rain',
      artist: 'Bob Studio', album: 'Cyber Dreams', genre: 'Electronic',
      tags: ['electronic', 'synthwave', 'ambient'],
      coverUrl: 'https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=400&q=80',
      audioUrl: '', duration: 280, views: 23400, likes: 1890, creatorIdx: 2,
    },
    // === Diana (Classical & Jazz) ===
    {
      id: 'seed-music-002', title: 'Impact Moderato',
      artist: 'Kevin MacLeod', album: 'Royalty Free Collection', genre: 'Classical',
      tags: ['classical', 'orchestral', 'royalty-free'],
      coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80',
      audioUrl: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3',
      duration: 180, views: 28700, likes: 1800, creatorIdx: 4,
    },
    {
      id: 'seed-music-005', title: 'Midnight Jazz Café',
      artist: 'The Blue Notes', album: 'After Hours', genre: 'Jazz',
      tags: ['jazz', 'smooth', 'cafe', 'instrumental'],
      coverUrl: 'https://images.unsplash.com/photo-1459749411177-0473ef716175?w=400&q=80',
      audioUrl: '', duration: 312, views: 56300, likes: 4200, creatorIdx: 4,
    },
    {
      id: 'seed-music-007', title: 'Moonlight Sonata (Piano Cover)',
      artist: 'Diana Arts', album: 'Classical Reimagined', genre: 'Classical',
      tags: ['classical', 'piano', 'beethoven', 'cover'],
      coverUrl: 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&q=80',
      audioUrl: '', duration: 420, views: 41200, likes: 3500, creatorIdx: 4,
    },
    // === Alice (World Music) ===
    {
      id: 'seed-music-004', title: 'Neon Skyline',
      artist: 'Synthwave Dreams', album: 'Digital Sunset', genre: 'Electronic',
      tags: ['synthwave', 'electronic', 'retro', '80s'],
      coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      audioUrl: '', duration: 256, views: 42100, likes: 3600, creatorIdx: 1,
    },
    {
      id: 'seed-music-008', title: 'Sakura Wind (さくら風)',
      artist: 'Alice Creative', album: 'Asian Vibes', genre: 'World',
      tags: ['japanese', 'asian', 'ambient', 'nature'],
      coverUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&q=80',
      audioUrl: '', duration: 195, views: 19800, likes: 1670, creatorIdx: 1,
    },
  ];

  for (const m of musicDefs) {
    const c = creators[m.creatorIdx];
    await prisma.music.upsert({
      where: { id: m.id },
      update: {
        title: m.title, artist: m.artist, album: m.album, genre: m.genre,
        tags: m.tags, coverUrl: m.coverUrl, audioUrl: m.audioUrl,
        duration: m.duration, views: m.views, likes: m.likes,
      },
      create: {
        id: m.id, title: m.title, artist: m.artist, album: m.album, genre: m.genre,
        tags: m.tags, coverUrl: m.coverUrl, audioUrl: m.audioUrl,
        duration: m.duration, views: m.views, likes: m.likes,
        creatorId: c.id,
      },
    });
  }

  // Also seed music-type Videos so /metadata/list?type=audio returns them
  for (const m of musicDefs) {
    const c = creators[m.creatorIdx];
    const videoId = m.id.replace('music', 'vaudio');
    await prisma.video.upsert({
      where: { id: videoId },
      update: {
        title: m.title, description: `${m.artist} — ${m.album}`,
        contentType: 'audio', genre: m.genre, tags: m.tags,
        coverUrl: m.coverUrl, videoUrl: m.audioUrl || '',
        duration: m.duration, views: m.views, likes: m.likes,
        creatorCkbAddress: c.address,
      },
      create: {
        id: videoId, title: m.title, description: `${m.artist} — ${m.album}`,
        contentType: 'audio', genre: m.genre, tags: m.tags,
        coverUrl: m.coverUrl, videoUrl: m.audioUrl || '',
        duration: m.duration, views: m.views, likes: m.likes,
        priceMode: 'both', priceUSDI: '2', pointsPrice: 50, streamPricePerMinute: 1,
        creatorId: c.id, creatorCkbAddress: c.address,
      },
    });
  }
  console.log(`  Music: ${musicDefs.length} seeded across ${new Set(musicDefs.map(m => m.creatorIdx)).size} creators`);

  // ──────────────────────────────────────────────
  // 5. DAILY TASKS
  // ──────────────────────────────────────────────
  const taskDefs = [
    { type: 'checkin', name: 'Daily Check-in', description: 'Log in to the platform each day.', points: 10, maxDaily: 1, requirement: 1, sortOrder: 1 },
    { type: 'watch_videos', name: 'Watch Videos', description: 'Watch at least 3 videos today.', points: 15, maxDaily: 1, requirement: 3, sortOrder: 2 },
    { type: 'comment', name: 'Leave a Comment', description: 'Post a comment on any video.', points: 5, maxDaily: 5, requirement: 1, sortOrder: 3 },
    { type: 'share', name: 'Share Content', description: 'Share a video or article with others.', points: 8, maxDaily: 3, requirement: 1, sortOrder: 4 },
    { type: 'live_watch', name: 'Watch a Live Stream', description: 'Spend 5+ minutes on a live stream.', points: 20, maxDaily: 1, requirement: 1, sortOrder: 5 },
  ];
  for (const t of taskDefs) {
    await prisma.dailyTask.upsert({ where: { type: t.type }, update: { ...t, enabled: true }, create: t });
  }
  console.log(`  Daily Tasks: ${taskDefs.length} seeded`);

  // ──────────────────────────────────────────────
  // 6. ACHIEVEMENTS
  // ──────────────────────────────────────────────
  const achievementDefs = [
    { slug: 'first_upload', name: 'First Upload', description: 'Upload your first video.', icon: 'upload', category: 'creator', tier: 'bronze', condition: JSON.stringify({ type: 'totalVideos', value: 1 }), pointsReward: 50, benefits: 'Creator badge' },
    { slug: 'first_like', name: 'First Like', description: 'Receive your first like.', icon: 'heart', category: 'creator', tier: 'bronze', condition: JSON.stringify({ type: 'totalLikes', value: 1 }), pointsReward: 20, benefits: 'Animated like effect' },
    { slug: 'watch_10_videos', name: 'Binge Watcher', description: 'Watch 10 different videos.', icon: 'play-circle', category: 'viewer', tier: 'silver', condition: JSON.stringify({ type: 'totalWatchedVideos', value: 10 }), pointsReward: 100, benefits: 'Exclusive viewer badge' },
    { slug: 'first_comment', name: 'Voice Heard', description: 'Post your first comment.', icon: 'message-circle', category: 'community', tier: 'bronze', condition: JSON.stringify({ type: 'totalComments', value: 1 }), pointsReward: 15, benefits: 'Comment highlight color' },
    { slug: 'tip_master', name: 'Tip Master', description: 'Send 1000+ points in tips.', icon: 'zap', category: 'community', tier: 'gold', condition: JSON.stringify({ type: 'totalTipsSent', value: 1000 }), pointsReward: 200, benefits: 'Gold tip animation' },
  ];
  for (const a of achievementDefs) {
    await prisma.achievement.upsert({ where: { slug: a.slug }, update: { ...a }, create: a });
  }
  console.log(`  Achievements: ${achievementDefs.length} seeded`);

  // ──────────────────────────────────────────────
  // 7. Follow relationships (some cross-follows)
  // ──────────────────────────────────────────────
  const follows = [
    { followerId: creators[1].id, followingId: creators[0].id },
    { followerId: creators[2].id, followingId: creators[0].id },
    { followerId: creators[3].id, followingId: creators[4].id },
    { followerId: creators[4].id, followingId: creators[2].id },
    { followerId: creators[0].id, followingId: creators[3].id },
  ];
  for (const f of follows) {
    try {
      await prisma.userFollow.upsert({
        where: { followerId_followingId: f },
        update: {},
        create: f,
      });
    } catch { /* ignore if FK fails */ }
  }
  console.log(`  Follows: ${follows.length} relationships seeded`);

  console.log('\n🎉 Seed complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   ${creators.length} Creators`);
  console.log(`   ${videoDefs.length} Videos`);
  console.log(`   ${articleDefs.length} Articles`);
  console.log(`   ${musicDefs.length} Music Tracks`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
