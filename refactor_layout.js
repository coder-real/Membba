import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(__dirname, 'src', 'pages')

// Update DashboardLayout.jsx first
const layoutPath = path.join(__dirname, 'src', 'components', 'DashboardLayout.jsx')
let layoutContent = fs.readFileSync(layoutPath, 'utf8')
layoutContent = layoutContent.replace(
  "import { Link, useLocation, useNavigate } from 'react-router-dom'",
  "import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'"
)
layoutContent = layoutContent.replace(
  "{children}",
  "{children || <Outlet />}"
)
fs.writeFileSync(layoutPath, layoutContent, 'utf8')
console.log('Updated DashboardLayout.jsx to support <Outlet />')

const dashboardPages = [
  'AutomationsPage.jsx',
  'CommunitiesPage.jsx',
  'CommunityFormPage.jsx',
  'DashboardPage.jsx',
  'MembersPage.jsx',
  'PaymentsPage.jsx',
  'SettingsPage.jsx'
]

dashboardPages.forEach(file => {
  const filePath = path.join(srcDir, file)
  if (!fs.existsSync(filePath)) return
  
  let content = fs.readFileSync(filePath, 'utf8')
  
  // Remove the import statement
  content = content.replace(/import\s+DashboardLayout\s+from\s+['"\.]+\/components\/DashboardLayout['"]\n?/g, '')
  content = content.replace(/import\s+\{\s*DashboardLayout\s*\}\s+from\s+['"\.]+\/components\/DashboardLayout['"]\n?/g, '')
  
  // Replace the opening tag (handling optional pageTitle props, multiline, etc)
  content = content.replace(/<DashboardLayout[^>]*>/g, '<>')
  
  // Replace the closing tag
  content = content.replace(/<\/DashboardLayout>/g, '</>')
  
  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`Updated ${file}`)
})
