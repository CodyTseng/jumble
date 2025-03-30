import { Separator } from '@/components/ui/separator'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import AddNewRelaySet from './AddNewRelaySet'
import { RelaySetsSettingComponentProvider } from './provider'
import RelayItem from './RelayItem'
import RelaySet from './RelaySet'
import TemporaryRelaySet from './TemporaryRelaySet'
import AddNewRelay from './AddNewRelay'

export default function FavoriteRelaysSetting() {
  const { relaySets, favoriteRelays } = useFavoriteRelays()

  return (
    <RelaySetsSettingComponentProvider>
      <div className="space-y-2 mt-4">
        <TemporaryRelaySet />
        {relaySets.map((relaySet) => (
          <RelaySet key={relaySet.id} relaySet={relaySet} />
        ))}
        <AddNewRelaySet />
      </div>
      <Separator className="my-4" />
      <div className="space-y-2">
        {favoriteRelays.map((relay) => (
          <RelayItem key={relay} relay={relay} />
        ))}
        <AddNewRelay />
      </div>
    </RelaySetsSettingComponentProvider>
  )
}
