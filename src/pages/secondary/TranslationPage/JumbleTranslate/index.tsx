import { AccountInfo } from './AccountInfo'
import { JumbleTranslateAccountProvider } from './JumbleTranslateAccountProvider'

export default function JumbleTranslate() {
  return (
    <JumbleTranslateAccountProvider>
      <AccountInfo />
    </JumbleTranslateAccountProvider>
  )
}
