import { config } from 'dotenv'
config({ path: '.env.local' })
import { moderateImage } from './lib/moderation'
import { appendLog } from './lib/ai/logger'

async function testVision() {
  console.log('GOOGLE_VISION_SERVICE_ACCOUNT_PATH:', process.env.GOOGLE_VISION_SERVICE_ACCOUNT_PATH)
  console.log('Testing Vision API with service account...')
  try {
    // Use a public image URL for testing
    const testImageUrl = 'https://picsum.photos/200/300' // Random image
    const result = await moderateImage(testImageUrl)
    console.log('Moderation result:', result)
  } catch (error) {
    console.error('Vision test failed:', error)
  }
}

async function testBetterStack() {
  console.log('Testing Better Stack logging...')
  try {
    await appendLog({ phase: 'test.betterstack', message: 'This is a test log from the app' })
    console.log('Log sent to Better Stack')
  } catch (error) {
    console.error('Better Stack test failed:', error)
  }
}

async function main() {
  await testVision()
  await testBetterStack()
}

main().catch(console.error)