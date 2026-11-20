import { useCallback, useEffect, useState } from 'react';
import { BoardPage } from './pages/BoardPage';
import { SettingsPage } from './pages/SettingsPage';

type Route = 'board' | 'settings';

function getRouteFromLocation(): Route {
  return window.location.pathname.startsWith('/settings') ? 'settings' : 'board';
}

export function App() {
  const [route, setRoute] = useState<Route>(getRouteFromLocation);

  const navigate = useCallback((target: Route) => {
    const nextPath = target === 'settings' ? '/settings' : '/';
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(target);
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(getRouteFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (route === 'settings') {
    return <SettingsPage onBack={() => navigate('board')} />;
  }

  return <BoardPage onOpenSettings={() => navigate('settings')} />;
}
