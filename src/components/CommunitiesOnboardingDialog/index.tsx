import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Globe, Users, Search, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function CommunitiesOnboardingDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  const content = (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">{t('Welcome to NIP-05 Communities!')}</h2>
        <p className="text-muted-foreground">
          {t(
            'Discover and connect with Nostr users through verified domain communities. Here\'s how it works:'
          )}
        </p>
      </div>

      <div className="space-y-4">
        <FeatureItem
          icon={<Globe className="size-5" />}
          title={t('Domain Communities')}
          description={t(
            'Users with verified NIP-05 identifiers (like user@domain.com) form communities around their domains'
          )}
        />

        <FeatureItem
          icon={<Search className="size-5" />}
          title={t('Discover & Search')}
          description={t(
            'Find communities by domain name, see trending communities, and get personalized suggestions based on who you follow'
          )}
        />

        <FeatureItem
          icon={<Users className="size-5" />}
          title={t('Community Feeds')}
          description={t(
            'View posts from all members of a community, browse member profiles, and explore their content'
          )}
        />

        <FeatureItem
          icon={<Heart className="size-5" />}
          title={t('Favorite Communities')}
          description={t(
            'Add communities to your favorites for quick access and organize them into custom sets'
          )}
        />
      </div>

      <div className="border-t pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          {t(
            'Start exploring communities in the Explore tab. You can search for domains, browse trending communities, or see suggestions based on your network.'
          )}
        </p>
        <Button
          className="w-full"
          onClick={() => {
            onOpenChange(false)
          }}
        >
          {t('Get Started')}
        </Button>
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <div className="p-6 max-h-[85vh] overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">{content}</DialogContent>
    </Dialog>
  )
}

function FeatureItem({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
