
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a Perceptual Hash (aHash - Average Hash) for a video file buffer.
 * Strategy:
 * 1. Extract a frame at 1s using ffmpeg.
 * 2. Resize to 8x8 and grayscale using sharp.
 * 3. Calculate average pixel intensity.
 * 4. Generate 64-bit hash based on pixel > average.
 */
export async function generateVideoPHash(videoBuffer: Buffer): Promise<string> {
    const tempInput = resolve(tmpdir(), `vp-${uuidv4()}.mp4`);
    const tempOutput = resolve(tmpdir(), `vp-${uuidv4()}.jpg`);

    try {
        writeFileSync(tempInput, videoBuffer);

        // Extract frame
        await new Promise<void>((resolve, reject) => {
            if (!ffmpegPath) return reject(new Error('ffmpeg binary not found'));

            const proc = spawn(ffmpegPath, [
                '-y',
                '-i', tempInput,
                '-ss', '00:00:01', // Capture at 1s
                '-vframes', '1',
                '-q:v', '2',
                tempOutput
            ]);

            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`ffmpeg exited with code ${code}`));
            });

            proc.on('error', (err) => reject(err));
        });

        if (!existsSync(tempOutput)) {
            throw new Error("Frame extraction failed - output file not created");
        }

        // Process image with sharp -> 8x8 Grayscale
        const pixelBuf = await sharp(tempOutput)
            .resize(8, 8, { fit: 'fill' })
            .grayscale()
            .raw()
            .toBuffer();

        // Calculate Average
        let sum = 0;
        for (let i = 0; i < pixelBuf.length; i++) {
            sum += pixelBuf[i];
        }
        const avg = sum / pixelBuf.length;

        // Generate Hash
        let hashBits = '';
        for (let i = 0; i < pixelBuf.length; i++) {
            hashBits += (pixelBuf[i] >= avg ? '1' : '0');
        }

        // Convert key binary string to Hex
        // 64 bits = 16 hex chars
        const hashHex = BigInt(`0b${hashBits}`).toString(16).padStart(16, '0');

        return hashHex;

    } catch (e) {
        console.error("[pHash] Error generating hash:", e);
        return "";
    } finally {
        // Cleanup
        try { if (existsSync(tempInput)) unlinkSync(tempInput); } catch { }
        try { if (existsSync(tempOutput)) unlinkSync(tempOutput); } catch { }
    }
}

/**
 * Calculate Hamming Distance between two hex pHashes.
 * Lower distance = more similar.
 * 0 = Identical.
 * < 5 = Very Similar (Likely slight transcode/resize).
 * < 10 = Similar.
 */
export function hammingDistance(hash1: string, hash2: string): number {
    if (!hash1 || !hash2) return 64; // Max distance if missing

    try {
        let val1 = BigInt(`0x${hash1}`);
        let val2 = BigInt(`0x${hash2}`);
        let xor = val1 ^ val2;
        let dist = 0;

        while (xor > 0n) {
            if (xor & 1n) dist++;
            xor >>= 1n;
        }
        return dist;
    } catch {
        return 64;
    }
}
