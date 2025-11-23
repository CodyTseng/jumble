import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Github,
  Copy,
  Download,
  FileJson,
  Image as ImageIcon,
  Info,
  Plus,
  Trash2,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'
import { useNostr } from '@/providers/NostrProvider'

const CreateCommunityPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={t('Create A Community')}
      displayScrollToTopButton
    >
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>{t('Community Setup')}</CardTitle>
            </div>
            <CardDescription>
              {t('Set up your NIP-05 community using GitHub Pages. Your community needs two files: a .well-known/nostr.json file and a favicon.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="instructions" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="instructions">{t('Instructions')}</TabsTrigger>
                <TabsTrigger value="manage">{t('Manage Members')}</TabsTrigger>
                <TabsTrigger value="requests">{t('Join Requests')}</TabsTrigger>
              </TabsList>

              <TabsContent value="instructions" className="space-y-6 mt-6">
                <GithubPagesInstructions />
              </TabsContent>

              <TabsContent value="manage" className="space-y-6 mt-6">
                <ManageMembersSection />
              </TabsContent>

              <TabsContent value="requests" className="space-y-6 mt-6">
                <JoinRequestsSection />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </SecondaryPageLayout>
  )
})
CreateCommunityPage.displayName = 'CreateCommunityPage'
export default CreateCommunityPage

function GithubPagesInstructions() {
  const { t } = useTranslation()
  const [verifyDomain, setVerifyDomain] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    nostrJson?: any
    faviconUrl?: string
    error?: string
  } | null>(null)

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
    toast(t('Copied to clipboard'))
  }

  const handleVerify = async () => {
    if (!verifyDomain) {
      toast(t('Please enter a domain to verify'))
      return
    }

    setIsVerifying(true)
    setVerificationResult(null)

    try {
      // Clean the domain (remove protocol if present)
      const cleanDomain = verifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')

      // Test favicon
      const faviconUrl = `https://${cleanDomain}/favicon.ico`

      // Test nostr.json
      const nostrJsonUrl = `https://${cleanDomain}/.well-known/nostr.json`

      const [faviconResponse, nostrJsonResponse] = await Promise.allSettled([
        fetch(faviconUrl, { method: 'HEAD' }),
        fetch(nostrJsonUrl)
      ])

      const faviconOk = faviconResponse.status === 'fulfilled' && faviconResponse.value.ok
      let nostrJson = null
      let nostrJsonOk = false

      if (nostrJsonResponse.status === 'fulfilled' && nostrJsonResponse.value.ok) {
        try {
          nostrJson = await nostrJsonResponse.value.json()
          nostrJsonOk = !!nostrJson.names
        } catch {
          nostrJsonOk = false
        }
      }

      if (faviconOk && nostrJsonOk) {
        setVerificationResult({
          success: true,
          nostrJson,
          faviconUrl
        })
        toast(t('Verification successful!'))
      } else {
        const errors = []
        if (!faviconOk) errors.push('favicon.ico')
        if (!nostrJsonOk) errors.push('.well-known/nostr.json')

        setVerificationResult({
          success: false,
          error: `Could not access: ${errors.join(', ')}`
        })
      }
    } catch (error) {
      setVerificationResult({
        success: false,
        error: 'Failed to verify domain. Please check the domain and try again.'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: GitHub Repository Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
            <CardTitle className="text-lg">{t('Create GitHub Repository')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('Create a new GitHub repository for your community. The repository name will become part of your domain (e.g., "my-community" becomes "my-community.github.io").')}
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open('https://github.com/new', '_blank')}
          >
            <Github className="w-4 h-4 mr-2" />
            {t('Create New Repository on GitHub')}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Create nostr.json File */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
            <CardTitle className="text-lg">{t('Create nostr.json File')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('Create a .well-known directory in your repository and add a nostr.json file with your community members.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label className="text-base">{t('How to create the .well-known directory on GitHub:')}</Label>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>{t('Go to your repository on GitHub')}</li>
              <li>{t('Click "Add file" → "Create new file"')}</li>
              <li>
                {t('In the file name box, type')}: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.well-known/nostr.json</code>
                <div className="text-xs mt-1 ml-6 text-muted-foreground/80">
                  {t('GitHub will automatically create the .well-known directory when you include the / in the filename')}
                </div>
              </li>
              <li>{t('Paste the nostr.json content below into the file editor')}</li>
              <li>{t('Click "Commit changes" at the bottom')}</li>
            </ol>
          </div>

          <div className="space-y-2">
            <Label>{t('Expected File Structure')}</Label>
            <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-xs">
              <div>your-repo/</div>
              <div className="ml-4">├── .well-known/</div>
              <div className="ml-8">│   └── nostr.json</div>
              <div className="ml-4">└── favicon.ico</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('nostr.json Template')}</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyText(getNostrJsonTemplate())}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t('Copy')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFile('nostr.json', getNostrJsonTemplate())}
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t('Download')}
                </Button>
              </div>
            </div>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
              {getNostrJsonTemplate()}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Add Favicon */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
            <CardTitle className="text-lg">{t('Add Community Favicon')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              {t('Add a favicon.ico file to the root of your repository. This will be used as your community icon.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('You can create a favicon using online tools like')} <a href="https://favicon.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">favicon.io</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Enable GitHub Pages */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
            <CardTitle className="text-lg">{t('Enable GitHub Pages')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t('Go to your repository settings on GitHub')}</li>
            <li>{t('Scroll down to the "Pages" section in the left sidebar')}</li>
            <li>{t('Under "Source", select the branch you want to deploy (usually "main" or "master")')}</li>
            <li>{t('Click "Save"')}</li>
            <li>{t('Wait a few minutes for GitHub to deploy your site')}</li>
            <li>{t('Your community will be available at: your-username.github.io/your-repo-name')}</li>
          </ol>
        </CardContent>
      </Card>

      {/* Step 5: Custom Domain (Optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">5</span>
            <CardTitle className="text-lg">{t('Custom Domain (Optional)')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('If you own a custom domain, you can use it instead of the default github.io domain.')}
          </p>
          <div className="space-y-3">
            <Label className="text-base">{t('How to set up a custom domain:')}</Label>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>{t('In your repository\'s GitHub Pages settings, enter your custom domain (e.g., community.example.com)')}</li>
              <li>
                {t('Add a CNAME record in your domain\'s DNS settings pointing to')}:
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs ml-1">&lt;username&gt;.github.io</code>
              </li>
              <li>{t('Wait for DNS propagation (this can take up to 24-48 hours)')}</li>
              <li>{t('Enable "Enforce HTTPS" in GitHub Pages settings once the domain is verified')}</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              {t('For more detailed instructions, see GitHub\'s official documentation on')}{' '}
              <a
                href="https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-an-apex-domain-for-your-github-pages-site"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t('setting up custom domains')}
              </a>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 6: Verify Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">6</span>
            <CardTitle className="text-lg">{t('Verify Your Setup')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('Test your community setup by entering your domain. We\'ll check if your files are accessible.')}
          </p>

          <div className="space-y-2">
            <Label htmlFor="verify-domain">{t('Your Domain')}</Label>
            <div className="flex gap-2">
              <Input
                id="verify-domain"
                placeholder="my-community.github.io or community.example.com"
                value={verifyDomain}
                onChange={(e) => setVerifyDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
              <Button onClick={handleVerify} disabled={isVerifying || !verifyDomain}>
                {isVerifying ? t('Verifying...') : t('Verify')}
              </Button>
            </div>
          </div>

          {verificationResult && (
            <div className="mt-4">
              {verificationResult.success ? (
                <div className="space-y-4">
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <Info className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      <strong>{t('Success!')}:</strong> {t('Your community is set up correctly!')}
                    </AlertDescription>
                  </Alert>

                  {/* Display Favicon */}
                  {verificationResult.faviconUrl && (
                    <div className="space-y-2">
                      <Label>{t('Favicon')}</Label>
                      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                        <img
                          src={verificationResult.faviconUrl}
                          alt="Community favicon"
                          className="w-8 h-8"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {t('Favicon found and accessible')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Display nostr.json */}
                  {verificationResult.nostrJson && (
                    <div className="space-y-2">
                      <Label>{t('Community Members')}</Label>
                      <div className="p-3 border rounded-lg bg-muted/50">
                        <div className="text-sm space-y-1">
                          {Object.entries(verificationResult.nostrJson.names || {}).map(([name, pubkey]) => (
                            <div key={name} className="flex items-center gap-2">
                              <span className="font-medium">{name}</span>
                              <span className="text-muted-foreground">→</span>
                              <code className="text-xs text-muted-foreground">{String(pubkey).slice(0, 16)}...</code>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="border-destructive/50 bg-destructive/10">
                    <Info className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-destructive">
                      <strong>{t('Error')}:</strong> {verificationResult.error}
                    </AlertDescription>
                  </Alert>

                  <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">{t('Troubleshooting tips:')}</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>{t('Make sure GitHub Pages is enabled and deployed')}</li>
                      <li>{t('Check that your files are in the correct location')}</li>
                      <li>{t('Wait a few minutes for GitHub Pages to update')}</li>
                      <li>{t('Verify your domain is spelled correctly')}</li>
                      <li>{t('Review the setup steps above')}</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* GitHub Integration Note */}
      <Alert>
        <Github className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('Coming Soon')}:</strong> {t('Direct GitHub integration to automatically create and update these files from this page.')}
        </AlertDescription>
      </Alert>
    </div>
  )
}

function ManageMembersSection() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [members, setMembers] = useState<Array<{ name: string; pubkey: string }>>([
    { name: 'admin', pubkey: pubkey || '' }
  ])
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberPubkey, setNewMemberPubkey] = useState('')

  const handleAddMember = () => {
    if (!newMemberName || !newMemberPubkey) {
      toast(t('Both name and pubkey are required'), {
        description: t('Error')
      })
      return
    }

    if (!newMemberPubkey.match(/^[0-9a-f]{64}$/)) {
      toast(t('Invalid pubkey format. Must be 64 character hex string.'), {
        description: t('Error')
      })
      return
    }

    setMembers([...members, { name: newMemberName, pubkey: newMemberPubkey }])
    setNewMemberName('')
    setNewMemberPubkey('')
    toast(t('Member added successfully'))
  }

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
    toast(t('Member removed'))
  }

  const generateNostrJson = () => {
    const names: Record<string, string> = {}
    members.forEach(member => {
      names[member.name] = member.pubkey
    })
    return JSON.stringify({ names }, null, 2)
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(generateNostrJson())
    toast(t('Copied to clipboard'))
  }

  const handleDownloadJson = () => {
    downloadFile('nostr.json', generateNostrJson())
    toast(t('File downloaded'))
  }

  return (
    <div className="space-y-6">
      {/* Add New Member */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Add Community Member')}</CardTitle>
          <CardDescription>
            {t('Add members to your community by providing their username and pubkey')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">{t('Username')}</Label>
            <Input
              id="member-name"
              placeholder="alice"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t('This will be the user\'s NIP-05 identifier')}: {newMemberName}@yourdomain.com
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-pubkey">{t('Public Key (hex)')}</Label>
            <Textarea
              id="member-pubkey"
              placeholder="npub1... or hex pubkey"
              value={newMemberPubkey}
              onChange={(e) => setNewMemberPubkey(e.target.value)}
              className="font-mono text-xs"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              {t('64 character hex public key')}
            </p>
          </div>

          <Button onClick={handleAddMember} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            {t('Add Member')}
          </Button>
        </CardContent>
      </Card>

      {/* Current Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Current Members')} ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((member, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{member.name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {member.pubkey}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMember(index)}
                  disabled={index === 0} // Can't remove admin (first member)
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generated nostr.json */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Generated nostr.json')}</CardTitle>
          <CardDescription>
            {t('Copy or download this file to .well-known/nostr.json in your repository')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
            {generateNostrJson()}
          </pre>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCopyJson} className="flex-1">
              <Copy className="w-4 h-4 mr-2" />
              {t('Copy')}
            </Button>
            <Button variant="outline" onClick={handleDownloadJson} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              {t('Download')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function JoinRequestsSection() {
  const { t } = useTranslation()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Incoming Join Requests')}</CardTitle>
          <CardDescription>
            {t('Review and approve requests from users who want to join your community')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('Coming Soon')}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t('This feature will allow users to request to join your community. You\'ll be able to review requests and add approved members directly from this interface.')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('In the meantime, users can contact you directly to request joining your community. You can add them manually in the "Manage Members" tab.')}
        </AlertDescription>
      </Alert>
    </div>
  )
}

// Helper functions
function getNostrJsonTemplate(): string {
  return `{
  "names": {
    "admin": "your-pubkey-here",
    "alice": "alice-pubkey-here",
    "bob": "bob-pubkey-here"
  }
}`
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
