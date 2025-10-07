#!/usr/bin/env node

/**
 * Configuration Validation Script
 * 
 * Validates that all required environment variables are set
 * and provides helpful error messages.
 */

import fs from 'fs';
import path from 'path';

function loadEnv(): { [key: string]: string } {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const env: { [key: string]: string } = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  return env;
}

function validateConfig(): boolean {
  console.log('\n🔍 Validating Configuration...\n');

  const env = loadEnv();
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const required = [
    { key: 'GEMINI_API_KEY', description: 'Google Gemini API key' },
    { key: 'CLOUDINARY_CLOUD_NAME', description: 'Cloudinary cloud name' },
    { key: 'CLOUDINARY_API_KEY', description: 'Cloudinary API key' },
    { key: 'CLOUDINARY_API_SECRET', description: 'Cloudinary API secret' },
  ];

  required.forEach(({ key, description }) => {
    if (!env[key] || env[key].startsWith('your_')) {
      errors.push(`❌ ${key} is missing or has placeholder value (${description})`);
    } else {
      console.log(`✅ ${key} is set`);
    }
  });

  // Optional but recommended
  const recommended = [
    { key: 'UPSTASH_REDIS_REST_URL', description: 'Redis URL for caching', feature: 'Distributed cache' },
    { key: 'SENTRY_DSN', description: 'Sentry DSN for monitoring', feature: 'Error monitoring' },
  ];

  recommended.forEach(({ key, description, feature }) => {
    if (!env[key] || env[key].startsWith('#')) {
      warnings.push(`⚠️  ${key} not set - ${feature} will be disabled (${description})`);
    } else {
      console.log(`✅ ${key} is set`);
    }
  });

  // Validate credit configuration
  console.log('\n💳 Credit System Configuration:');
  const costAnalysis = parseInt(env.CREDIT_COST_ANALYSIS || '0', 10);
  const costGeneration = parseInt(env.CREDIT_COST_GENERATION || '0', 10);
  const enforceCredits = env.ENFORCE_CREDITS === 'true';

  console.log(`   Analysis cost: ${costAnalysis} credits`);
  console.log(`   Generation cost: ${costGeneration} credits`);
  console.log(`   Enforce credits: ${enforceCredits}`);

  if (costAnalysis === 0 && costGeneration === 0 && !enforceCredits) {
    console.log('   ℹ️  Currently in FREE TESTING mode');
  } else if (enforceCredits && (costAnalysis > 0 || costGeneration > 0)) {
    console.log('   ✅ Production credit system enabled');
  } else {
    warnings.push('⚠️  Credit configuration seems inconsistent. Review CREDIT_* variables.');
  }

  // Validate feature flags
  console.log('\n🎛️  Feature Flags:');
  const features = [
    'RATE_LIMIT_ENABLED',
    'CACHE_ENABLED',
    'MODERATION_ENABLED',
    'WATERMARK_ENABLED',
    'PRIVACY_MODE',
  ];

  features.forEach(feature => {
    const enabled = env[feature] === 'true';
    console.log(`   ${feature}: ${enabled ? '✅ Enabled' : '⚪ Disabled'}`);
  });

  // Validate timeouts
  console.log('\n⏱️  Timeout Configuration:');
  const analysisTimeout = parseInt(env.AI_ANALYSIS_TIMEOUT || '45000', 10);
  const generationTimeout = parseInt(env.AI_GENERATION_TIMEOUT || '60000', 10);

  console.log(`   Analysis timeout: ${analysisTimeout}ms`);
  console.log(`   Generation timeout: ${generationTimeout}ms`);

  if (analysisTimeout < 30000) {
    warnings.push('⚠️  Analysis timeout is very low (< 30s). May cause timeouts.');
  }
  if (generationTimeout < 45000) {
    warnings.push('⚠️  Generation timeout is very low (< 45s). May cause timeouts.');
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`   ${warning}`));
  }

  // Print errors
  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`   ${error}`));
    console.log('\n');
    console.log('💡 To fix these errors:');
    console.log('   1. Copy .env.example to .env.local');
    console.log('   2. Fill in the required values');
    console.log('   3. Or run: npm run setup');
    console.log('');
      process.exit(1);
  }

  // Success
  console.log('\n✅ Configuration is valid!\n');
  
  if (warnings.length > 0) {
    console.log('ℹ️  You can ignore warnings if you understand the implications.\n');
  }

  return true;
}

// Run validation
try {
  validateConfig();
} catch (err: unknown) {
    console.error('\n❌ Error during validation:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
}
