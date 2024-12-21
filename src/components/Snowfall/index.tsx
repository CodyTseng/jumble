import { useChristmas } from '@/providers/ChristmasProvider'
import SnowfallComponent from 'react-snowfall'

export default function Snowfall() {
  const { enabled } = useChristmas()
  if (!enabled) return null

  return (
    <SnowfallComponent
      style={{ zIndex: 99999, background: 'transparent' }}
      snowflakeCount={50}
      wind={[-1, 2]}
      radius={[0.5, 2]}
    />
  )
}
