import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Github,
  Copy,
  Download,
  Image as ImageIcon,
  Info,
  Trash2,
  Clock,
  Search,
  Check,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { useNostr } from '@/providers/NostrProvider'
import { useSearchProfiles } from '@/hooks/useSearchProfiles'
import { useFetchProfile } from '@/hooks'
import { userIdToPubkey } from '@/lib/pubkey'
import { nip19 } from 'nostr-tools'
import UserItem from '@/components/UserItem'
import client from '@/services/client.service'
import nip05CommunityService from '@/services/nip05-community.service'

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
    details?: string
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

      // Try multiple favicon formats
      const faviconFormats = ['favicon.svg', 'favicon.png', 'favicon.ico', 'apple-touch-icon.png']
      const faviconUrls = faviconFormats.map(format => `https://${cleanDomain}/${format}`)

      // Test nostr.json
      const nostrJsonUrl = `https://${cleanDomain}/.well-known/nostr.json`

      // Fetch all favicon formats in parallel
      const faviconResponses = await Promise.allSettled(
        faviconUrls.map(url => fetch(url, { method: 'HEAD' }))
      )

      // Find first successful favicon
      let faviconUrl = null
      for (let i = 0; i < faviconResponses.length; i++) {
        const response = faviconResponses[i]
        if (response.status === 'fulfilled' && response.value.ok) {
          faviconUrl = faviconUrls[i]
          break
        }
      }

      // Fetch nostr.json
      const nostrJsonResponse = await fetch(nostrJsonUrl)
      let nostrJson = null
      let nostrJsonOk = false
      let nostrJsonError = ''

      if (nostrJsonResponse.ok) {
        try {
          const text = await nostrJsonResponse.text()
          nostrJson = JSON.parse(text)

          if (!nostrJson.names) {
            nostrJsonError = 'File is missing the "names" property'
          } else if (Object.keys(nostrJson.names).length === 0) {
            nostrJsonError = 'The "names" object is empty. Add at least one member.'
          } else {
            nostrJsonOk = true
          }
        } catch (e) {
          nostrJsonError = 'Invalid JSON format: ' + (e as Error).message
        }
      } else {
        nostrJsonError = `HTTP ${nostrJsonResponse.status}: File not accessible at ${nostrJsonUrl}`
      }

      if (faviconUrl && nostrJsonOk) {
        setVerificationResult({
          success: true,
          nostrJson,
          faviconUrl
        })
        toast(t('Verification successful!'))
      } else {
        const errors = []
        if (!faviconUrl) errors.push('favicon (tried: svg, png, ico)')
        if (!nostrJsonOk) errors.push('.well-known/nostr.json')

        setVerificationResult({
          success: false,
          error: `Could not access: ${errors.join(', ')}`,
          details: nostrJsonError,
          faviconUrl: faviconUrl || undefined // Show favicon even if nostr.json fails
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
              <div className="ml-4">├── .nojekyll</div>
              <div className="ml-4">└── favicon.png (or .svg, .ico)</div>
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
              {t('Add a favicon file to the root of your repository. This will be used as your community icon.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('Supported formats')}: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">favicon.svg</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">favicon.png</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-xs">favicon.ico</code>
            </p>
            <p className="text-sm text-muted-foreground">
              {t('You can create a favicon using online tools like')} <a href="https://favicon.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">favicon.io</a>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Add .nojekyll File */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
            <CardTitle className="text-lg">{t('Add .nojekyll File')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <Info className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-700 dark:text-yellow-300">
              <strong>{t('Critical Step')}:</strong> {t('GitHub Pages uses Jekyll by default, which ignores directories starting with a dot (like .well-known). You must disable Jekyll to make your community accessible.')}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Label className="text-base">{t('How to add .nojekyll file:')}</Label>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
              <li>{t('Go to your repository on GitHub')}</li>
              <li>{t('Click "Add file" → "Create new file"')}</li>
              <li>
                {t('In the file name box, type')}: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.nojekyll</code>
              </li>
              <li>{t('Leave the file content empty (no text needed)')}</li>
              <li>{t('Click "Commit changes" at the bottom')}</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Step 5: Enable GitHub Pages */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">5</span>
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

      {/* Step 6: Custom Domain (Optional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">6</span>
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

      {/* Step 7: Verify Setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">7</span>
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

                  {/* Show detailed error */}
                  {verificationResult.details && (
                    <div className="p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg space-y-2">
                      <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{t('Details:')}</p>
                      <p className="text-sm text-yellow-600 dark:text-yellow-300">{verificationResult.details}</p>
                      {verificationResult.details.includes('HTTP') && (
                        <div className="pt-2">
                          <a
                            href={`https://${verifyDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/.well-known/nostr.json`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {t('Open nostr.json in new tab to debug')} →
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Display favicon if found, even with errors */}
                  {verificationResult.faviconUrl && (
                    <div className="space-y-2">
                      <Label className="text-green-600 dark:text-green-400">✓ {t('Favicon Found')}</Label>
                      <div className="flex items-center gap-3 p-3 border border-green-500/50 bg-green-500/10 rounded-lg">
                        <img
                          src={verificationResult.faviconUrl}
                          alt="Community favicon"
                          className="w-8 h-8"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {t('Favicon is accessible')}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">{t('Troubleshooting tips:')}</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>{t('Make sure GitHub Pages is enabled and deployed')}</li>
                      <li>{t('Check that your files are in the correct location')}</li>
                      <li>{t('Ensure nostr.json has valid JSON with a "names" object')}</li>
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

function MemberSearchInput({
  searchInput,
  setSearchInput,
  debouncedSearch,
  isSearching,
  setIsSearching,
  onSelectUser
}: {
  searchInput: string
  setSearchInput: (input: string) => void
  debouncedSearch: string
  isSearching: boolean
  setIsSearching: (searching: boolean) => void
  onSelectUser: (userId: string, profile: any) => void
}) {
  const { t } = useTranslation()
  const { profiles, isFetching } = useSearchProfiles(debouncedSearch, 10)
  const [displayList, setDisplayList] = useState(false)

  useEffect(() => {
    setDisplayList(isSearching && !!searchInput)
  }, [isSearching, searchInput])

  const handleSelectProfile = (profile: any) => {
    onSelectUser(profile.npub, profile)
    setSearchInput('')
    setDisplayList(false)
  }

  // Handle direct npub/hex input
  const handleDirectInput = () => {
    const trimmed = searchInput.trim()

    // Check if it's a valid hex pubkey
    if (/^[0-9a-f]{64}$/.test(trimmed)) {
      onSelectUser(trimmed, { username: 'user', pubkey: trimmed })
      return
    }

    // Try to decode npub/nprofile
    try {
      let id = trimmed
      if (id.startsWith('nostr:')) {
        id = id.slice(6)
      }
      const { type } = nip19.decode(id)
      if (['nprofile', 'npub'].includes(type)) {
        onSelectUser(id, { username: 'user' })
        return
      }
    } catch {
      // Not a valid identifier
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t('Search by name, npub, or NIP-05...')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onFocus={() => setIsSearching(true)}
          onBlur={() => setTimeout(() => setIsSearching(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleDirectInput()
            }
          }}
          className="pl-10"
        />
      </div>

      {displayList && (debouncedSearch || profiles.length > 0) && (
        <div className="absolute top-full mt-1 w-full bg-surface-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {isFetching && profiles.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('Searching...')}
            </div>
          ) : profiles.length > 0 ? (
            <div className="p-2">
              {profiles.map((profile) => (
                <div
                  key={profile.pubkey}
                  className="hover:bg-accent rounded-md cursor-pointer"
                  onClick={() => handleSelectProfile(profile)}
                >
                  <UserItem
                    userId={profile.npub}
                    className="pointer-events-none"
                    hideFollowButton
                    showFollowingBadge
                  />
                </div>
              ))}
            </div>
          ) : debouncedSearch ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('No users found. Try entering a full npub or hex pubkey and press Enter.')}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

function ManageMembersSection() {
  const { t } = useTranslation()
  const { profile } = useNostr()
  const [members, setMembers] = useState<Array<{ username: string; alias: string; pubkey: string }>>([])
  const [existingNostrJson, setExistingNostrJson] = useState<any>(null)
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchInput])

  // Fetch current user's existing nostr.json if they have a NIP-05
  useEffect(() => {
    const fetchExistingNostrJson = async () => {
      if (!profile?.nip05) return

      try {
        const [, domain] = profile.nip05.split('@')
        if (!domain) return

        const response = await fetch(`https://${domain}/.well-known/nostr.json`)
        if (response.ok) {
          const json = await response.json()
          setExistingNostrJson(json)
        }
      } catch (error) {
        // Silently fail - user may not have a nostr.json yet
      }
    }

    fetchExistingNostrJson()
  }, [profile])

  const handleAddMember = (userId: string, userProfile: any) => {
    const hexPubkey = userIdToPubkey(userId)

    // Check for duplicates
    if (members.some(m => m.pubkey === hexPubkey)) {
      toast(t('This user is already in the member list'))
      return
    }

    const username = userProfile?.username || userProfile?.name || 'user'

    setMembers([...members, {
      username,
      alias: username,
      pubkey: hexPubkey
    }])

    setSearchInput('')
    toast(t('Member added successfully'))
  }

  const handleUpdateAlias = (index: number, newAlias: string) => {
    const updated = [...members]
    updated[index].alias = newAlias
    setMembers(updated)
  }

  const handleRemoveMember = (index: number) => {
    setMembers(members.filter((_, i) => i !== index))
    toast(t('Member removed'))
  }

  const generateNostrJson = () => {
    const names: Record<string, string> = {}

    // Merge existing names if available
    if (existingNostrJson?.names) {
      Object.assign(names, existingNostrJson.names)
    }

    // Add new members
    members.forEach(member => {
      names[member.alias] = member.pubkey
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
      {/* User Search Intake */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Add Community Members')}</CardTitle>
          <CardDescription>
            {t('Search for users by name, npub, or NIP-05 identifier')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MemberSearchInput
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            debouncedSearch={debouncedSearch}
            isSearching={isSearching}
            setIsSearching={setIsSearching}
            onSelectUser={handleAddMember}
          />
        </CardContent>
      </Card>

      {/* Member Intake Table */}
      {members.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('Members to Add')} ({members.length})</CardTitle>
            <CardDescription>
              {t('Review and edit member aliases before generating nostr.json')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium">{t('Username')}</th>
                    <th className="text-left p-3 text-sm font-medium">{t('Alias')}</th>
                    <th className="text-left p-3 text-sm font-medium">{t('Public Key')}</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-3 text-sm">{member.username}</td>
                      <td className="p-3">
                        <Input
                          value={member.alias}
                          onChange={(e) => handleUpdateAlias(index, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </td>
                      <td className="p-3 text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                        {member.pubkey}
                      </td>
                      <td className="p-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live nostr.json Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Live nostr.json Preview')}</CardTitle>
          <CardDescription>
            {existingNostrJson
              ? t('Your existing nostr.json merged with new members')
              : t('Generated nostr.json file - copy or download to .well-known/nostr.json')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto max-h-96">
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
  const { account } = useNostr()
  const [requests, setRequests] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [followingList, setFollowingList] = useState<Set<string>>(new Set())

  useEffect(() => {
    const fetchJoinRequests = async () => {
      if (!account) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)

        // First, fetch the user's following list
        const followList = await client.fetchFollowList(account.pubkey)
        const followingSet = new Set(followList || [])
        setFollowingList(followingSet)

        // Fetch join requests where the current user is tagged as admin
        const events = await client.fetchEvents({
          kinds: [39457], // COMMUNITY_JOIN_REQUEST
          '#p': [account.pubkey]
        })

        if (events && events.length > 0) {
          // Filter to only show requests from users we follow
          const filteredRequests = events.filter((event) => followingSet.has(event.pubkey))

          // Sort by newest first
          filteredRequests.sort((a, b) => b.created_at - a.created_at)

          setRequests(filteredRequests)
        }
      } catch (error) {
        console.error('Error fetching join requests:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchJoinRequests()
  }, [account])

  if (!account) {
    return (
      <div className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t('Please login to view join requests for your community')}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('Important')}:</strong> {t('Only requests from users you follow are shown here. This helps maintain a well-connected community and filters out spam.')}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('Incoming Join Requests')}</CardTitle>
          <CardDescription>
            {t('Review requests from users who want to join your community. Add them to your nostr.json file to approve.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="w-12 h-12 bg-muted rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded animate-pulse w-32" />
                    <div className="h-3 bg-muted rounded animate-pulse w-48" />
                    <div className="h-3 bg-muted rounded animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t('No Pending Requests')}</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {t('You have no pending join requests from users you follow. When users request to join, they will appear here.')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <JoinRequestCard key={request.id} request={request} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>{t('How to approve')}:</strong> {t('To approve a request, add the user\'s pubkey to your domain\'s .well-known/nostr.json file. Once they appear in the file, the request will automatically be marked as approved.')}
        </AlertDescription>
      </Alert>
    </div>
  )
}

function JoinRequestCard({ request }: { request: any }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(request.pubkey)
  const [isApproved, setIsApproved] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  // Extract domain from d-tag
  const domainTag = request.tags.find((tag: string[]) => tag[0] === 'd')
  const domain = domainTag?.[1]

  // Check if user is already in nostr.json (with periodic refresh)
  useEffect(() => {
    const checkApproval = async () => {
      if (!domain || isApproved) return

      setIsChecking(true)
      try {
        // Force refresh the community members to check latest nostr.json
        await nip05CommunityService.refreshCommunityMembers(domain)
        const members = await nip05CommunityService.getDomainMembers(domain)
        if (members.includes(request.pubkey)) {
          setIsApproved(true)

          // TODO: Phase 5 - Notification System
          // When request is approved, we should notify the requester
          // Possible implementations:
          // 1. Send a DM (NIP-04) to the requester notifying them of approval
          // 2. Publish a kind 1 reply/mention to their join request event
          // 3. Use a notification relay (NIP-51 or custom)
          // For now, the user can check their request status manually or receive
          // the periodic auto-check notification in the UI
          console.log('[TODO] Send approval notification to requester:', request.pubkey)
        }
      } catch (error) {
        console.error('Error checking approval status:', error)
      } finally {
        setIsChecking(false)
      }
    }

    // Initial check
    checkApproval()

    // Periodic check every 30 seconds (only if not yet approved)
    const interval = setInterval(() => {
      if (!isApproved) {
        checkApproval()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [domain, request.pubkey, isApproved])

  const handleCopyPubkey = () => {
    navigator.clipboard.writeText(request.pubkey)
    toast(t('Pubkey copied to clipboard'))
  }

  const handleRefreshStatus = async () => {
    if (!domain || isApproved) return

    setIsChecking(true)
    try {
      await nip05CommunityService.refreshCommunityMembers(domain)
      const members = await nip05CommunityService.getDomainMembers(domain)
      if (members.includes(request.pubkey)) {
        setIsApproved(true)
        toast.success(t('Request has been approved!'))
      } else {
        toast.info(t('User not yet added to nostr.json'))
      }
    } catch (error) {
      console.error('Error refreshing approval status:', error)
      toast.error(t('Failed to check approval status'))
    } finally {
      setIsChecking(false)
    }
  }

  const displayName = profile?.username || request.pubkey.slice(0, 8)
  const nip05 = profile?.nip05
  const about = profile?.about

  return (
    <div className={`p-4 border rounded-lg ${isApproved ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : ''}`}>
      <div className="flex items-start gap-4">
        <UserItem userId={request.pubkey} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="font-semibold">{displayName}</div>
            {isApproved && (
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Check className="w-3 h-3" />
                {t('Approved')}
              </div>
            )}
            {isChecking && !isApproved && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {t('Checking...')}
              </div>
            )}
          </div>

          {nip05 && <div className="text-sm text-muted-foreground mb-2">{nip05}</div>}

          <div className="text-sm mb-3 p-3 bg-muted/50 rounded">
            <strong>{t('Requesting to join')}:</strong> {domain}
          </div>

          {request.content && (
            <div className="text-sm text-muted-foreground mb-3 italic">
              "{request.content}"
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {new Date(request.created_at * 1000).toLocaleString()}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyPubkey} className="gap-2">
            <Copy className="w-3 h-3" />
            {t('Copy Pubkey')}
          </Button>
          {!isApproved && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshStatus}
              disabled={isChecking}
              className="gap-2"
            >
              <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
              {t('Check Status')}
            </Button>
          )}
        </div>
      </div>
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
