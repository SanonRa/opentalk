// Copyright (c) 2026. All rights reserved.

import React from 'react';
import {
  Home,
  MessageSquareText,
  BookmarkCheck,
  History,
  Settings,
  Sparkles,
} from 'lucide-react';
import { MicStatusBanner } from './MicStatusBanner';

export type AppRoute = 'home' | 'conversation' | 'templates' | 'history' | 'settings';

interface AppShellProps {
  activeRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onOpenProModal: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: AppRoute; label: string; icon: React.FC<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'conversation', label: 'Talk', icon: MessageSquareText },
  { id: 'templates', label: 'Replies', icon: BookmarkCheck },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const AppShell: React.FC<AppShellProps> = ({
  activeRoute,
  onNavigate,
  onOpenProModal,
  children,
}) => {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar */}
      <header className="hc-surface sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 rounded-lg py-1 pr-2 text-left"
            aria-label="OpenTalk Home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-lg font-extrabold text-white shadow-sm">
              OT
            </span>
            <div>
              <div className="text-base font-bold leading-tight tracking-tight">OpenTalk</div>
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Accessible Two-Way Voice
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={onOpenProModal}
            className="hc-card inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/60"
            aria-label="Learn about upcoming OpenTalk Pro features"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Pro Preview</span>
          </button>
        </div>
        <MicStatusBanner />
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 pb-24 pt-4 sm:px-5">
        {children}
      </main>

      {/* Mobile-First Bottom Navigation */}
      <nav
        aria-label="Primary navigation"
        className="hc-surface fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      >
        <div className="mx-auto grid max-w-4xl grid-cols-5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeRoute === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'text-sky-600 dark:text-sky-400'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
