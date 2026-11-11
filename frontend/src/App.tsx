import { useStore } from './store'
import Onboarding from './screens/Onboarding'
import Pantry from './screens/Pantry'

export default function App() {
  const profile = useStore((s) => s.profile)
  return <div className="min-h-full">{profile ? <Pantry /> : <Onboarding />}</div>
}
