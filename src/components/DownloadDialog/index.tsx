import LinuxLogo from '@/assets/LinuxLogo'
import MacosLogo from '@/assets/MacosLogo'
import WindowsLogo from '@/assets/WindowsLogo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Download, Github, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type LogoComponent = (props: { className?: string }) => JSX.Element

const RELEASES_BASE = 'https://github.com/CodyTseng/jumble/releases/latest'

interface DownloadOption {
  label: string
  format: string
  filename: string
  Icon: LogoComponent
  noteKey?: string
}

const OPTIONS: DownloadOption[] = [
  {
    label: 'macOS',
    format: 'DMG · Apple Silicon',
    filename: 'Jumble-mac-arm64.dmg',
    Icon: MacosLogo
  },
  {
    label: 'Windows',
    format: 'Installer (.exe) · x64',
    filename: 'Jumble-windows-x64.exe',
    Icon: WindowsLogo
  },
  {
    label: 'Linux',
    format: 'AppImage · x86_64',
    filename: 'Jumble-linux-x86_64.AppImage',
    Icon: LinuxLogo
  },
  {
    label: 'Linux',
    format: 'Debian / Ubuntu (.deb) · amd64',
    filename: 'Jumble-linux-amd64.deb',
    Icon: LinuxLogo,
    noteKey: 'No auto-updates — manual re-download required'
  }
]

function buildHref(filename: string) {
  return `${RELEASES_BASE}/download/${filename}`
}

export default function DownloadDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Download Jumble Desktop')}</DialogTitle>
          <DialogDescription>
            {t('Pick a build for your operating system.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {OPTIONS.map((o) => (
            <DownloadRow key={o.filename} option={o} />
          ))}
        </div>

        <a
          href={RELEASES_BASE}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs underline-offset-2 hover:underline"
        >
          <Github className="size-3.5" />
          {t('View all releases on GitHub')}
        </a>
      </DialogContent>
    </Dialog>
  )
}

function DownloadRow({ option }: { option: DownloadOption }) {
  const { t } = useTranslation()
  const { Icon, label, format, filename, noteKey } = option
  return (
    <a
      href={buildHref(filename)}
      target="_blank"
      rel="noreferrer"
      className="group hover:bg-muted/60 flex items-center gap-3 rounded-lg border p-3 transition-colors"
    >
      <Icon className="text-muted-foreground size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="text-muted-foreground truncate text-xs">{format}</div>
        {noteKey && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-yellow-600 dark:text-yellow-500">
            <Info className="size-3 shrink-0" />
            <span className="truncate">{t(noteKey)}</span>
          </div>
        )}
      </div>
      <Download className="text-muted-foreground size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
    </a>
  )
}
