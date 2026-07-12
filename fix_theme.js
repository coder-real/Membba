import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src')

const walk = (dir) => {
  let results = []
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(filePath))
    } else if (filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
      results.push(filePath)
    }
  })
  return results
}

const mappings = [
  // Backgrounds
  { from: /\bbg-\[\#000\]/g, to: 'bg-white dark:bg-[#000]' },
  { from: /\bbg-\[\#0a0a0a\]/g, to: 'bg-gray-50 dark:bg-[#0a0a0a]' },
  { from: /\bbg-\[\#111\]/g, to: 'bg-white dark:bg-[#111]' },
  { from: /\bbg-\[\#1e1f22\]/g, to: 'bg-gray-100 dark:bg-[#1e1f22]' },
  
  // Text colors
  { from: /\btext-\[\#dcddde\]/g, to: 'text-gray-900 dark:text-[#dcddde]' },
  { from: /\btext-\[\#f2f3f5\]/g, to: 'text-gray-900 dark:text-[#f2f3f5]' },
  { from: /\btext-\[\#dbdee1\]/g, to: 'text-gray-800 dark:text-[#dbdee1]' },
  { from: /\btext-\[\#b5bac1\]/g, to: 'text-gray-600 dark:text-[#b5bac1]' },
  { from: /\btext-\[\#96989d\]/g, to: 'text-gray-500 dark:text-[#96989d]' },
  { from: /\btext-\[\#72767d\]/g, to: 'text-gray-500 dark:text-[#72767d]' },
  { from: /\btext-\[\#4f545c\]/g, to: 'text-gray-400 dark:text-[#4f545c]' },
  
  // Text white/black
  { from: /\btext-white\b/g, to: 'text-black dark:text-white' },
  { from: /\btext-white\/([0-9]+)\b/g, to: 'text-black/$1 dark:text-white/$1' },
  
  // Borders
  { from: /\bborder-white\/\[0\.0[2468]\]/g, to: 'border-gray-200 dark:border-white/10' },
  { from: /\bborder-\[\#1e1e1e\]/g, to: 'border-gray-200 dark:border-[#1e1e1e]' }
]

const files = walk(srcDir)
let changedCount = 0

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8')
  let changed = false
  
  // Skip LandingPage.jsx because it has manual JS toggle logic
  // and its own explicit text-white toggles
  if (file.includes('LandingPage.jsx')) return

  mappings.forEach(map => {
    const rawContent = content
    content = content.replace(map.from, (match, ...args) => {
      const offset = args[args.length - 2]
      const string = args[args.length - 1]
      
      // Check if it's already prefixed with 'dark:'
      const before = string.substring(Math.max(0, offset - 5), offset)
      if (before === 'dark:') return match
      
      changed = true
      
      // Handle the regex group substitution manually since we're using a callback
      if (map.to.includes('$1')) {
        const p1 = args[0] // first capture group
        return map.to.replace('$1', p1)
      }
      
      return map.to
    })
  })

  // Prevent double matching bugs (e.g. text-black dark:text-black dark:text-white)
  // This is a crude replace, so we just write it back if we modified it
  if (changed) {
    fs.writeFileSync(file, content, 'utf8')
    console.log(`Updated ${path.basename(file)}`)
    changedCount++
  }
})

console.log(`\nTheme rewrite complete. Modified ${changedCount} files.`)
