import { Monitor, Moon, Sun } from 'lucide-react'
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { useTheme } from '../contexts/ThemeContext'

export default function Appearance() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-sm text-muted">Make this workspace feel right for you.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <p className="text-sm text-muted">Your preference is saved on this browser.</p>
        </CardHeader>
        <CardContent>
          <fieldset>
            <legend className="mb-4 text-sm font-medium">Colour theme</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'Use system', icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${theme === value ? 'border-accent bg-accent-soft' : 'border-line'}`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => setTheme(value)}
                  />
                  <Icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </div>
  )
}
