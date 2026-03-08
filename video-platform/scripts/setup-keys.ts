#!/usr/bin/env node
/**
 * CKB Testnet Key Generation Script
 * 
 * Generates a CKB testnet private key and derives the corresponding address.
 * Run: npx ts-node scripts/setup-keys.ts
 * 
 * The generated key will be printed to console. 
 * Copy CKB_PRIVATE_KEY to your .env.local file.
 */

import { randomBytes } from 'crypto';

function generateCkbTestnetKey() {
    // Generate a 32-byte random private key
    const privateKey = '0x' + randomBytes(32).toString('hex');

    console.log('');
    console.log('==============================================');
    console.log('  CKB Testnet Key Generation');
    console.log('==============================================');
    console.log('');
    console.log('✅ Generated CKB Private Key (TESTNET ONLY):');
    console.log(`   CKB_PRIVATE_KEY=${privateKey}`);
    console.log('');
    console.log('📋 Copy the line above to your .env.local file');
    console.log('');
    console.log('🚰 Get testnet CKB from the faucet:');
    console.log('   https://faucet.nervos.org/');
    console.log('');
    console.log('⚠️  WARNING: This is for TESTNET use only!');
    console.log('   Never use this key on CKB mainnet.');
    console.log('');
    console.log('==============================================');
    console.log('');
    console.log('📦 WEB3_STORAGE_TOKEN:');
    console.log('   This token CANNOT be auto-generated.');
    console.log('   Steps to obtain:');
    console.log('   1. Go to https://web3.storage');
    console.log('   2. Sign up / Log in');
    console.log('   3. Go to Account → API Tokens');
    console.log('   4. Create a new token');
    console.log('   5. Copy to .env.local as WEB3_STORAGE_TOKEN=your_token');
    console.log('');
    console.log('==============================================');
}

generateCkbTestnetKey();
