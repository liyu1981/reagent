import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { useSiteTheme } from './lib/theme';
import { Demos } from './pages/Demos';
import { Docs } from './pages/Docs';
import { Home } from './pages/Home';

function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-28 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
      >
        Back home
      </Link>
    </div>
  );
}

export function App() {
  const { preference, theme, setPreference } = useSiteTheme();

  return (
    <Routes>
      <Route
        element={<Layout preference={preference} onPreferenceChange={setPreference} />}
      >
        <Route index element={<Home theme={theme} />} />
        <Route path="demos" element={<Demos theme={theme} />} />
        <Route path="docs" element={<Docs />} />
        <Route path="docs/:slug" element={<Docs />} />
        <Route
          path="filesystem-tools"
          element={<Navigate to="/docs/tools-and-skills#filesystem-tools" replace />}
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
