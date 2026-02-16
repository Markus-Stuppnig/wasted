#!/usr/bin/env node
/**
 * Generates tiny WAV sound files for onboarding sound effects.
 * Run: node scripts/generate-sounds.js
 */

const wav = require("node-wav");
const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.join(__dirname, "..", "assets", "sounds");

function generateSamples(durationMs, generator) {
  const numSamples = Math.floor((durationMs / 1000) * SAMPLE_RATE);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / numSamples;
    samples[i] = generator(t, progress);
  }
  return samples;
}

function envelope(progress, attack, release) {
  if (progress < attack) return progress / attack;
  if (progress > 1 - release) return (1 - progress) / release;
  return 1;
}

function writeWav(filename, samples) {
  const buffer = wav.encode([samples], { sampleRate: SAMPLE_RATE, bitDepth: 16 });
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`  ${filename} (${buffer.byteLength} bytes)`);
}

// 1. Word pop — soft 25ms droplet: quick pitch drop (1400→700Hz) with fast decay
//    Mimics the subtle "tick" of iOS keyboard or a tiny water drop
const wordPop = generateSamples(25, (t, p) => {
  const freq = 1400 - 700 * p; // descending pitch gives organic "plop"
  const env = Math.exp(-p * 6);  // exponential decay — no sustain
  return Math.sin(2 * Math.PI * freq * t) * env * 0.18;
});

// 2. Transition — 120ms descending sweep from 600Hz to 400Hz
const transition = generateSamples(120, (t, p) => {
  const freq = 600 - 200 * p;
  const env = envelope(p, 0.05, 0.5);
  return Math.sin(2 * Math.PI * freq * t) * env * 0.35;
});

// 3. Complete — similar feel to transition but slightly brighter and longer
//    Gentle descending sweep like transition, with a soft bright tail
const complete = generateSamples(150, (t, p) => {
  const freq = 700 - 200 * p;
  const env = Math.exp(-p * 4);
  const fundamental = Math.sin(2 * Math.PI * freq * t);
  const shimmer = Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.15;
  return (fundamental + shimmer) * env * 0.3;
});

console.log("Generating sound files:");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
writeWav("word-pop.wav", wordPop);
writeWav("transition.wav", transition);
writeWav("complete.wav", complete);
console.log("Done!");
