// Copyright (c) 2026. All rights reserved.

import React, { useState } from 'react';
import { OpenTalkProvider } from './engine/ConversationContext';
import { AppRoute, AppShell } from './components/layout/AppShell';
import { ProBadgeModal } from './components/common/ProBadgeModal';
import { HomePage } from './pages/HomePage';
import { ConversationPage } from './pages/ConversationPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const [route, setRoute] = useState<AppRoute>('home');
  const [proModalOpen, setProModalOpen] = useState(false);

  return (
    <OpenTalkProvider>
      <AppShell
        activeRoute={route}
        onNavigate={setRoute}
        onOpenProModal={() => setProModalOpen(true)}
      >
        {route === 'home' && (
          <HomePage
            onNavigate={setRoute}
            onOpenProModal={() => setProModalOpen(true)}
          />
        )}
        {route === 'conversation' && <ConversationPage onNavigate={setRoute} />}
        {route === 'templates' && <TemplatesPage />}
        {route === 'history' && <HistoryPage />}
        {route === 'settings' && <SettingsPage />}
      </AppShell>

      <ProBadgeModal open={proModalOpen} onClose={() => setProModalOpen(false)} />
    </OpenTalkProvider>
  );
};

export default App;
