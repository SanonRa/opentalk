// Copyright (c) 2026. All rights reserved.

import React, { useState } from 'react';
import { Plus, Volume2, Pencil, Trash2, Check, X } from 'lucide-react';
import { useOpenTalk } from '../engine/ConversationContext';
import { QuickReplyTemplate } from '../types/template';

export const TemplatesPage: React.FC = () => {
  const { templates, addTemplate, updateTemplate, deleteTemplate, sendResponse } = useOpenTalk();

  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState<QuickReplyTemplate['category']>('custom');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    addTemplate(newText, newCategory);
    setNewText('');
  };

  const startEdit = (tpl: QuickReplyTemplate) => {
    setEditingId(tpl.id);
    setEditingText(tpl.text);
  };

  const commitEdit = (id: string) => {
    if (editingText.trim()) {
      updateTemplate(id, editingText);
    }
    setEditingId(null);
    setEditingText('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Quick-Reply Templates</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tap any phrase to speak it aloud immediately, or add and edit your own everyday replies.
        </p>
      </div>

      {/* Add Template Form */}
      <form
        onSubmit={handleAdd}
        className="hc-card space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <label htmlFor="new-template-input" className="block text-sm font-bold">
          Create a Quick Reply
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="new-template-input"
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="e.g., Please face me when speaking."
            className="hc-surface min-h-[48px] flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-base dark:border-slate-700 dark:bg-slate-950"
          />
          <select
            aria-label="Template category"
            value={newCategory}
            onChange={(e) =>
              setNewCategory(e.target.value as QuickReplyTemplate['category'])
            }
            className="hc-surface min-h-[48px] rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="custom">Custom</option>
            <option value="clarification">Clarification</option>
            <option value="assistance">Assistance</option>
            <option value="general">General</option>
          </select>
          <button
            type="submit"
            disabled={!newText.trim()}
            className="hc-accent-btn inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>
      </form>

      {/* Template List */}
      <ul className="space-y-3">
        {templates.map((tpl) => {
          const isEditing = editingId === tpl.id;
          return (
            <li
              key={tpl.id}
              className="hc-card flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
            >
              {isEditing ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    aria-label="Edit template text"
                    className="hc-surface min-h-[44px] flex-1 rounded-xl border border-sky-500 bg-slate-50 px-3 text-base dark:bg-slate-950"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => commitEdit(tpl.id)}
                    aria-label="Save template changes"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    aria-label="Cancel editing"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold leading-snug">{tpl.text}</p>
                    <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {tpl.category}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        sendResponse(tpl.text, { fromTemplate: true, speak: true })
                      }
                      className="hc-accent-btn inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden="true" />
                      <span>Speak Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(tpl)}
                      aria-label={`Edit "${tpl.text}"`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(tpl.id)}
                      aria-label={`Delete "${tpl.text}"`}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
