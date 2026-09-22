import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Theme, UserSettings } from '../api/types';

const LANGUAGES = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'zh', 'ja', 'ko', 'ru', 'ar'];

interface Props {
  settings: UserSettings | null;
  onSettings: (settings: UserSettings) => void;
}

export default function Settings({ settings, onSettings }: Props) {
  const [language, setLanguage] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('DARK');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLanguage(settings?.language ?? '');
    setTheme(settings?.theme ?? 'DARK');
  }, [settings]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await api.saveSettings({
        language: language.trim() ? language.trim() : null,
        theme,
      });
      onSettings(next);
      setSaved(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>Settings</h1>
      </div>

      {error && <div className="banner error">{error}</div>}
      {saved && <div className="banner ok">Settings saved</div>}

      <form className="card settings-card" onSubmit={submit}>
        <h3>Personal preferences</h3>

        <div className="field">
          <label>Default language</label>
          <input
            type="text"
            list="lang-codes"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="e.g. en"
          />
          <datalist id="lang-codes">
            {LANGUAGES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
          <span className="muted small">Used as the default language for new stories.</span>
        </div>

        <div className="field">
          <label>Look and feel</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            <option value="DARK">Dark</option>
            <option value="LIGHT">Light</option>
          </select>
          <span className="muted small">Applies immediately after saving.</span>
        </div>

        <button className="primary" type="submit" disabled={busy}>
          Save settings
        </button>
      </form>
    </div>
  );
}