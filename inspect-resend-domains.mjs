import fs from 'node:fs'

for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!match) continue
  let value = match[2]
  if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value)
  if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1)
  process.env[match[1]] = value
}

const response = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY },
})
if (!response.ok) throw new Error('resend_domains_' + response.status)
const body = await response.json()
const domains = (body.data || []).map((domain) => ({
  id: domain.id,
  name: domain.name,
  status: domain.status,
  clickTracking: domain.click_tracking,
  trackingSubdomain: domain.tracking_subdomain,
}))
const domain = domains.find((item) => item.name === 'doscientos.es')
if (!domain) throw new Error('resend_domain_not_found')
const update = await fetch('https://api.resend.com/domains/' + domain.id, {
  method: 'PATCH',
  headers: {
    Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ click_tracking: false }),
})
if (!update.ok) throw new Error('resend_domain_update_' + update.status)
process.stdout.write(`${JSON.stringify({ domain: domain.name, clickTrackingDisabled: true })}\n`)
