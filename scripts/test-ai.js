import { generateText } from '../server/services/ai.js'

const prompt = process.argv.slice(2).join(' ') || 'Write a friendly one-sentence welcome message for a paid WhatsApp community called Membba Creators.'

try {
  const result = await generateText(prompt)
  console.log('\n--- Groq response ---\n')
  console.log(result)
  console.log('\n---------------------\n')
} catch (err) {
  console.error('[test-ai] failed:', err.message)
  process.exit(1)
}
