// Copyright (c) 2026. All rights reserved.

export interface QuickReplyTemplate {
  id: string;
  text: string;
  category: 'general' | 'clarification' | 'assistance' | 'custom';
  createdAt: number;
  updatedAt: number;
}
