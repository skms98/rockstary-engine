'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface TaggingEntry {
  id: string;
  user_id: string;
  title: string;
  source_text: string;
  status: 'draft' | 'initial_done' | 'validated' | 'error';
  initial_result?: any;
  validated_result?: any;
  created_at: string;
  updated_at: string;
}

interface TaxonomyItem {
  id: string;
  type: 'category' | 'tag';
  name: string;
  domain: 'event' | 'attraction' | 'both' | null;
  parent_group?: string;
  section?: string;
  description?: string;
  is_selectable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TaggingPrompt {
  id: string;
  prompt_key: 'tagging_beast' | 'validator';
  prompt_text: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  initial_done: number;
  validated: number;
  error: number;
}

export default function TaggingPage() {
  const [activeTab, setActiveTab] = useState<'classify' | 'taxonomy' | 'prompts'>('classify');
  const [entries, setEntries] = useState<TaggingEntry[]>([]);
  const [categories, setCategories] = useState<TaxonomyItem[]>([]);
  const [tags, setTags] = useState<TaxonomyItem[]>([]);
  const [prompts, setPrompts] = useState<Map<string, TaggingPrompt>>(new Map());
  const [stats, setStats] = useState<Stats>({ total: 0, initial_done: 0, validated: 0, error: 0 });

  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntryText, setNewEntryText] = useState('');

  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [processingEntryId, setProcessingEntryId] = useState<string | null>(null);
  const [processingPhase, setProcessingPhase] = useState<'initial' | 'validator' | null>(null);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDomain, setNewCategoryDomain] = useState<'event' | 'attraction' | 'both'>('both');
  const [newCategoryType, setNewCategoryType] = useState<'standalone' | 'parent' | 'subcategory'>('standalone');
  const [newCategoryParent, setNewCategoryParent] = useState('');

  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagSection, setNewTagSection] = useState('Genre');

  const [editingPromptKey, setEditingPromptKey] = useState<'tagging_beast' | 'validator' | null>(null);
  const [editingPromptText, setEditingPromptText] = useState('');
  const [savingPromptKey, setSavingPromptKey] = useState<'tagging_beast' | 'validator' | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tagSections = ['Genre', 'Nationality', 'Broad Type', 'Attractions', 'Festive', 'Sports', 'Gaming'];
  const domains = ['event', 'attraction', 'both'] as const;

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [entriesData, taxonomyData, promptsData] = await Promise.all([
        supabase.from('tagging_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('tagging_taxonomy').select('*').order('sort_order', { ascending: true }),
        supabase.from('tagging_prompts').select('*'),
      ]);

      if (entriesData.data) setEntries(entriesData.data);

      if (taxonomyData.data) {
        const categoriesData = taxonomyData.data.filter(item => item.type === 'category');
        const tagsData = taxonomyData.data.filter(item => item.type === 'tag');
        setCategories(categoriesData);
        setTags(tagsData);
      }

      if (promptsData.data) {
        const promptsMap = new Map<string, TaggingPrompt>();
        promptsData.data.forEach(prompt => {
          promptsMap.set(prompt.prompt_key, prompt);
        });
        setPrompts(promptsMap);
      }

      calculateStats(entriesData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (entriesList: TaggingEntry[]) => {
    setStats({
      total: entriesList.length,
      initial_done: entriesList.filter(e => ['initial_done', 'validated', 'error'].includes(e.status)).length,
      validated: entriesList.filter(e => e.status === 'validated').length,
      error: entriesList.filter(e => e.status === 'error').length,
    });
  };

  const handleNewEntry = async () => {
    if (!newEntryTitle.trim() || !newEntryText.trim()) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('tagging_entries')
        .insert({
          user_id: session.user.id,
          title: newEntryTitle,
          source_text: newEntryText,
          status: 'draft',
          initial_result: null,
          validated_result: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setEntries([data, ...entries]);
      setNewEntryTitle('');
      setNewEntryText('');
      setShowNewEntryModal(false);
      calculateStats([data, ...entries]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    }
  };

  const handleRunInitialTagging = async (entryId: string) => {
    try {
      setProcessingEntryId(entryId);
      setProcessingPhase('initial');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const response = await fetch('/api/tagging/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          entryId,
          phase: 'initial',
          authToken,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      // Reload the entry from database instead of double-updating
      const { data, error: selectError } = await supabase
        .from('tagging_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (selectError) throw selectError;

      setEntries(entries.map(e => (e.id === entryId ? data : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run initial tagging');
    } finally {
      setProcessingEntryId(null);
      setProcessingPhase(null);
    }
  };

  const handleRunValidator = async (entryId: string) => {
    try {
      setProcessingEntryId(entryId);
      setProcessingPhase('validator');

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const entry = entries.find(e => e.id === entryId);
      if (!entry?.initial_result) {
        setError('Initial tagging must be completed first');
        return;
      }

      const response = await fetch('/api/tagging/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          entryId,
          phase: 'validator',
          initialResult: entry.initial_result,
          authToken,
        }),
      });

      if (!response.ok) throw new Error(`API error: ${response.statusText}`);

      // Reload the entry from database instead of double-updating
      const { data, error: selectError } = await supabase
        .from('tagging_entries')
        .select('*')
        .eq('id', entryId)
        .single();

      if (selectError) throw selectError;

      setEntries(entries.map(e => (e.id === entryId ? data : e)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run validator');
    } finally {
      setProcessingEntryId(null);
      setProcessingPhase(null);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError('Category name required');
      return;
    }

    if (newCategoryType === 'subcategory' && !newCategoryParent.trim()) {
      setError('Parent category required for subcategories');
      return;
    }

    try {
      let isSelectableValue = true;
      let parentGroupValue = '';

      if (newCategoryType === 'parent') {
        isSelectableValue = false;
        parentGroupValue = '';
      } else if (newCategoryType === 'subcategory') {
        isSelectableValue = true;
        parentGroupValue = newCategoryParent;
      } else {
        // standalone
        isSelectableValue = true;
        parentGroupValue = '';
      }

      const { data, error: insertError } = await supabase
        .from('tagging_taxonomy')
        .insert({
          type: 'category',
          name: newCategoryName,
          domain: newCategoryDomain,
          is_selectable: isSelectableValue,
          parent_group: parentGroupValue,
          sort_order: (categories.length + 1) * 10,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCategories([...categories, data]);
      setNewCategoryName('');
      setNewCategoryType('standalone');
      setNewCategoryParent('');
      setShowAddCategory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const categoryToDelete = categories.find(c => c.id === categoryId);
    const isParent = categoryToDelete && !categoryToDelete.is_selectable && !categoryToDelete.parent_group;
    const confirmMessage = isParent ? 'Delete this parent and all its subcategories?' : 'Delete this category?';

    if (!confirm(confirmMessage)) return;

    try {
      // If deleting a parent, also delete all its subcategories
      if (isParent && categoryToDelete) {
        const subcategoriesToDelete = categories.filter(c => c.parent_group === categoryToDelete.name);
        for (const sub of subcategoriesToDelete) {
          await supabase
            .from('tagging_taxonomy')
            .delete()
            .eq('id', sub.id);
        }
      }

      const { error: deleteError } = await supabase
        .from('tagging_taxonomy')
        .delete()
        .eq('id', categoryId);

      if (deleteError) throw deleteError;

      setCategories(categories.filter(c => c.id !== categoryId && !(isParent && categoryToDelete && c.parent_group === categoryToDelete.name)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) {
      setError('Tag name required');
      return;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('tagging_taxonomy')
        .insert({
          type: 'tag',
          name: newTagName,
          domain: 'both',
          section: newTagSection,
          is_selectable: true,
          sort_order: (tags.length + 1) * 10,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTags([...tags, data]);
      setNewTagName('');
      setShowAddTag(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Delete this tag?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('tagging_taxonomy')
        .delete()
        .eq('id', tagId);

      if (deleteError) throw deleteError;

      setTags(tags.filter(t => t.id !== tagId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  const handleSavePrompt = async (promptKey: 'tagging_beast' | 'validator') => {
    try {
      setSavingPromptKey(promptKey);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) throw new Error('Not authenticated');

      const existingPrompt = prompts.get(promptKey);

      if (existingPrompt) {
        const { data, error: updateError } = await supabase
          .from('tagging_prompts')
          .update({
            prompt_text: editingPromptText,
            updated_by: session.user.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingPrompt.id)
          .select()
          .single();

        if (updateError) throw updateError;

        const newPromptsMap = new Map(prompts);
        newPromptsMap.set(promptKey, data);
        setPrompts(newPromptsMap);
      } else {
        const { data, error: insertError } = await supabase
          .from('tagging_prompts')
          .insert({
            prompt_key: promptKey,
            prompt_text: editingPromptText,
            updated_by: session.user.email,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newPromptsMap = new Map(prompts);
        newPromptsMap.set(promptKey, data);
        setPrompts(newPromptsMap);
      }

      setEditingPromptKey(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setSavingPromptKey(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-pl-dark/50 text-pl-muted border border-pl-border/50';
      case 'initial_done':
        return 'bg-pl-accent/20 text-pl-accent-light border border-pl-accent/30';
      case 'validated':
        return 'bg-pl-success/20 text-pl-success border border-pl-success/30';
      case 'error':
        return 'bg-pl-warning/20 text-pl-warning border border-pl-warning/30';
      default:
        return 'bg-pl-dark/50 text-pl-muted border border-pl-border/50';
    }
  };

  const getGroupedCategories = () => {
    const parentCats = categories.filter(c => !c.is_selectable && !c.parent_group);
    const standaloneCats = categories.filter(c => c.is_selectable && !c.parent_group);
    const childCatsMap = new Map<string, TaxonomyItem[]>();

    categories.filter(c => c.is_selectable && c.parent_group).forEach(c => {
      const existing = childCatsMap.get(c.parent_group!) || [];
      existing.push(c);
      childCatsMap.set(c.parent_group!, existing);
    });

    return { parentCats, standaloneCats, childCatsMap };
  };

  const SpinnerIcon = () => (
    <div className="w-5 h-5 border-2 border-pl-dark/30 border-t-pl-dark rounded-full animate-spin" />
  );

  const ChevronDownIcon = ({ isOpen }: { isOpen: boolean }) => (
    <svg
      className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );

  const PlusIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const PlayIcon = () => (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
    </svg>
  );

  const CheckIcon = () => (
    <svg className="w-5 h-5 text-pl-success" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );

  const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const formatSourceTextPreview = (text: string) => {
    return text.length > 150 ? text.substring(0, 150) + '...' : text;
  };

  return (
    <div className="min-h-screen bg-pl-navy text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-pl-gold mb-2">Categories & Tags Engine</h1>
          <p className="text-pl-muted">Manage tagging workflow and taxonomy</p>
        </div>
        <button
          onClick={() => setShowNewEntryModal(true)}
          className="pl-btn-primary flex items-center gap-2"
        >
          <PlusIcon />
          New Entry
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="pl-card p-6 border border-pl-border">
          <div className="text-pl-muted text-sm mb-2">Total Entries</div>
          <div className="text-3xl font-bold text-pl-gold">{stats.total}</div>
        </div>
        <div className="pl-card p-6 border border-pl-border">
          <div className="text-pl-muted text-sm mb-2">Initial Done</div>
          <div className="text-3xl font-bold text-pl-accent-light">{stats.initial_done}</div>
        </div>
        <div className="pl-card p-6 border border-pl-border">
          <div className="text-pl-muted text-sm mb-2">Validated</div>
          <div className="text-3xl font-bold text-pl-success">{stats.validated}</div>
        </div>
        <div className="pl-card p-6 border border-pl-border">
          <div className="text-pl-muted text-sm mb-2">Errors</div>
          <div className="text-3xl font-bold text-pl-warning">{stats.error}</div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-pl-warning/20 border border-pl-warning/30 rounded text-pl-warning flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-pl-warning">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-pl-border">
        {(['classify', 'taxonomy', 'prompts'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === tab
                ? 'text-pl-gold border-b-2 border-pl-gold'
                : 'text-pl-muted hover:text-pl-text-dim'
            }`}
          >
            {tab === 'classify' && 'Classify'}
            {tab === 'taxonomy' && 'Taxonomy'}
            {tab === 'prompts' && 'Prompts'}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <SpinnerIcon />
        </div>
      ) : (
        <>
          {/* CLASSIFY TAB */}
          {activeTab === 'classify' && (
            <div className="space-y-4">
              {entries.length === 0 ? (
                <div className="pl-card p-12 text-center border border-pl-border">
                  <p className="text-pl-muted">No entries yet. Click "New Entry" to get started.</p>
                </div>
              ) : (
                entries.map(entry => (
                  <div key={entry.id} className="pl-card border border-pl-border overflow-hidden">
                    {/* Entry Header */}
                    <div
                      className="p-6 cursor-pointer hover:bg-pl-dark transition flex items-center gap-4"
                      onClick={() => setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id)}
                    >
                      <ChevronDownIcon isOpen={expandedEntryId === entry.id} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white mb-2">{entry.title}</h3>
                        <p className="text-pl-muted text-sm">{formatSourceTextPreview(entry.source_text)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusBadge(entry.status)}`}>
                        {entry.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {/* Entry Details */}
                    {expandedEntryId === entry.id && (
                      <div className="p-6 bg-pl-dark border-t border-pl-border space-y-6">
                        {/* Source Text */}
                        <div>
                          <label className="block text-pl-gold font-semibold mb-2">Source Text</label>
                          <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-60 overflow-y-auto">
                            <p className="text-pl-muted whitespace-pre-wrap">{entry.source_text}</p>
                          </div>
                        </div>

                        {/* Initial Tagging */}
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <button
                              onClick={() => handleRunInitialTagging(entry.id)}
                              disabled={processingEntryId === entry.id && processingPhase === 'initial'}
                              className="pl-btn-primary flex items-center gap-2 disabled:opacity-50"
                            >
                              {processingEntryId === entry.id && processingPhase === 'initial' ? (
                                <SpinnerIcon />
                              ) : (
                                <PlayIcon />
                              )}
                              Run Initial Tagging
                            </button>
                            {entry.status !== 'draft' && <CheckIcon />}
                          </div>
                          {entry.initial_result && (
                            <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-64 overflow-y-auto">
                              <pre className="text-sm text-pl-muted font-mono whitespace-pre-wrap break-words">
                                {JSON.stringify(entry.initial_result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* Validator */}
                        <div>
                          <div className="flex items-center gap-4 mb-4">
                            <button
                              onClick={() => handleRunValidator(entry.id)}
                              disabled={entry.status === 'draft' || (processingEntryId === entry.id && processingPhase === 'validator')}
                              className="pl-btn-primary flex items-center gap-2 disabled:opacity-50"
                            >
                              {processingEntryId === entry.id && processingPhase === 'validator' ? (
                                <SpinnerIcon />
                              ) : (
                                <PlayIcon />
                              )}
                              Run Validator
                            </button>
                            {entry.status === 'validated' && <CheckIcon />}
                          </div>
                          {entry.validated_result && (
                            <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-64 overflow-y-auto">
                              <pre className="text-sm text-pl-muted font-mono whitespace-pre-wrap break-words">
                                {JSON.stringify(entry.validated_result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAXONOMY TAB */}
          {activeTab === 'taxonomy' && (
            <div className="grid grid-cols-2 gap-8">
              {/* Categories */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-pl-gold">Categories</h2>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="pl-btn-secondary flex items-center gap-2"
                  >
                    <PlusIcon />
                    Add
                  </button>
                </div>

                {showAddCategory && (
                  <div className="pl-card p-4 mb-4 border border-pl-border space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-pl-gold mb-2">Category Type</label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                          <input
                            type="radio"
                            name="categoryType"
                            value="standalone"
                            checked={newCategoryType === 'standalone'}
                            onChange={(e) => setNewCategoryType(e.target.value as 'standalone' | 'parent' | 'subcategory')}
                            className="w-4 h-4"
                          />
                          Standalone
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                          <input
                            type="radio"
                            name="categoryType"
                            value="parent"
                            checked={newCategoryType === 'parent'}
                            onChange={(e) => setNewCategoryType(e.target.value as 'standalone' | 'parent' | 'subcategory')}
                            className="w-4 h-4"
                          />
                          Parent (Non-selectable)
                        </label>
                        <label className="flex items-center gap-2 text-white cursor-pointer">
                          <input
                            type="radio"
                            name="categoryType"
                            value="subcategory"
                            checked={newCategoryType === 'subcategory'}
                            onChange={(e) => setNewCategoryType(e.target.value as 'standalone' | 'parent' | 'subcategory')}
                            className="w-4 h-4"
                          />
                          Subcategory
                        </label>
                      </div>
                    </div>

                    {newCategoryType === 'subcategory' && (
                      <div>
                        <label className="block text-sm font-semibold text-pl-gold mb-2">Parent Category</label>
                        <select
                          value={newCategoryParent}
                          onChange={(e) => setNewCategoryParent(e.target.value)}
                          className="pl-input w-full"
                        >
                          <option value="">Select parent category</option>
                          {categories.filter(c => !c.is_selectable && !c.parent_group).map(parent => (
                            <option key={parent.id} value={parent.name}>{parent.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <input
                      type="text"
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="pl-input w-full"
                    />
                    <select
                      value={newCategoryDomain}
                      onChange={(e) => setNewCategoryDomain(e.target.value as 'event' | 'attraction' | 'both')}
                      className="pl-input w-full"
                    >
                      {domains.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleAddCategory} className="pl-btn-primary flex-1">Save</button>
                      <button onClick={() => {
                        setShowAddCategory(false);
                        setNewCategoryType('standalone');
                        setNewCategoryParent('');
                      }} className="pl-btn-secondary flex-1">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {(() => {
                    const { standaloneCats, parentCats, childCatsMap } = getGroupedCategories();

                    return (
                      <>
                        {/* Standalone Categories */}
                        {standaloneCats.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-pl-muted mb-3 uppercase tracking-wider">Standalone</h3>
                            <div className="space-y-2">
                              {standaloneCats.map(cat => (
                                <div key={cat.id} className="pl-card p-4 border border-pl-border flex items-center justify-between">
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-white">{cat.name}</h4>
                                    <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-2 inline-block border border-pl-accent/30">
                                      {cat.domain}
                                    </span>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleDeleteCategory(cat.id)}
                                      className="p-2 text-pl-warning hover:bg-pl-warning/10 rounded transition"
                                      title="Delete"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Parent Categories with Subcategories */}
                        {parentCats.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-pl-muted mb-3 uppercase tracking-wider">Parent Categories</h3>
                            <div className="space-y-4">
                              {parentCats.map(parent => (
                                <div key={parent.id}>
                                  <div className="pl-card p-4 border border-pl-border flex items-start justify-between bg-pl-navy/50">
                                    <div className="flex-1 flex items-center gap-3">
                                      <svg className="w-5 h-5 text-pl-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="text-lg font-bold text-pl-gold">{parent.name}</h4>
                                          <span className="text-xs px-2 py-1 bg-pl-dark text-pl-muted rounded border border-pl-gold/30 font-semibold">
                                            [PARENT]
                                          </span>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-2 inline-block border border-pl-accent/30">
                                          {parent.domain}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => handleDeleteCategory(parent.id)}
                                        className="p-2 text-pl-warning hover:bg-pl-warning/10 rounded transition"
                                        title="Delete parent and subcategories"
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Subcategories */}
                                  {childCatsMap.has(parent.name) && (
                                    <div className="space-y-2 mt-2 ml-6 pl-4 border-l-2 border-pl-dark">
                                      {childCatsMap.get(parent.name)!.map(child => (
                                        <div key={child.id} className="pl-card p-3 border border-pl-border/50 flex items-center justify-between bg-pl-dark/30">
                                          <div className="flex-1">
                                            <h5 className="font-semibold text-white text-sm">{child.name}</h5>
                                            <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-1 inline-block border border-pl-accent/30">
                                              {child.domain}
                                            </span>
                                          </div>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => handleDeleteCategory(child.id)}
                                              className="p-2 text-pl-warning hover:bg-pl-warning/10 rounded transition"
                                              title="Delete"
                                            >
                                              <TrashIcon />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {categories.length === 0 && (
                          <div className="text-center py-8 text-pl-muted">
                            No categories yet. Add one to get started!
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Tags */}
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-pl-gold">Tags</h2>
                  <button
                    onClick={() => setShowAddTag(true)}
                    className="pl-btn-secondary flex items-center gap-2"
                  >
                    <PlusIcon />
                    Add
                  </button>
                </div>

                {showAddTag && (
                  <div className="pl-card p-4 mb-4 border border-pl-border space-y-3">
                    <input
                      type="text"
                      placeholder="Tag name"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="pl-input w-full"
                    />
                    <select
                      value={newTagSection}
                      onChange={(e) => setNewTagSection(e.target.value)}
                      className="pl-input w-full"
                    >
                      {tagSections.map(section => (
                        <option key={section} value={section}>{section}</option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button onClick={handleAddTag} className="pl-btn-primary flex-1">Save</button>
                      <button onClick={() => setShowAddTag(false)} className="pl-btn-secondary flex-1">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {tags.map(tag => (
                    <div key={tag.id} className="pl-card p-4 border border-pl-border flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-white">{tag.name}</h4>
                        <span className="text-xs px-2 py-1 bg-pl-gold/10 text-pl-gold rounded mt-2 inline-block border border-pl-gold/30">
                          {tag.section}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteTag(tag.id)}
                          className="p-2 text-pl-warning hover:bg-pl-warning/10 rounded transition"
                          title="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PROMPTS TAB */}
          {activeTab === 'prompts' && (
            <div className="grid grid-cols-2 gap-8">
              {/* Tagging Beast Prompt */}
              <div className="pl-card p-6 border border-pl-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-pl-gold">Tagging Beast Prompt</h3>
                  {editingPromptKey === 'tagging_beast' ? (
                    <button
                      onClick={() => handleSavePrompt('tagging_beast')}
                      disabled={savingPromptKey === 'tagging_beast'}
                      className="pl-btn-primary text-sm disabled:opacity-50"
                    >
                      {savingPromptKey === 'tagging_beast' ? 'Saving...' : 'Save'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPromptKey('tagging_beast');
                        setEditingPromptText(prompts.get('tagging_beast')?.prompt_text || '');
                      }}
                      className="pl-btn-secondary text-sm"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingPromptKey === 'tagging_beast' ? (
                  <textarea
                    value={editingPromptText}
                    onChange={(e) => setEditingPromptText(e.target.value)}
                    className="pl-input w-full h-96 p-4 font-mono text-sm"
                    placeholder="Enter tagging beast prompt..."
                  />
                ) : (
                  <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-96 overflow-y-auto">
                    <pre className="text-sm text-pl-muted whitespace-pre-wrap break-words">
                      {prompts.get('tagging_beast')?.prompt_text || 'No prompt set'}
                    </pre>
                  </div>
                )}

                {prompts.get('tagging_beast') && (
                  <div className="text-xs text-pl-muted">
                    Last updated by {prompts.get('tagging_beast')?.updated_by} on{' '}
                    {new Date(prompts.get('tagging_beast')?.updated_at || '').toLocaleString()}
                  </div>
                )}
              </div>

              {/* Validator Prompt */}
              <div className="pl-card p-6 border border-pl-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-pl-gold">Validator Prompt</h3>
                  {editingPromptKey === 'validator' ? (
                    <button
                      onClick={() => handleSavePrompt('validator')}
                      disabled={savingPromptKey === 'validator'}
                      className="pl-btn-primary text-sm disabled:opacity-50"
                    >
                      {savingPromptKey === 'validator' ? 'Saving...' : 'Save'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingPromptKey('validator');
                        setEditingPromptText(prompts.get('validator')?.prompt_text || '');
                      }}
                      className="pl-btn-secondary text-sm"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingPromptKey === 'validator' ? (
                  <textarea
                    value={editingPromptText}
                    onChange={(e) => setEditingPromptText(e.target.value)}
                    className="pl-input w-full h-96 p-4 font-mono text-sm"
                    placeholder="Enter validator prompt..."
                  />
                ) : (
                  <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-96 overflow-y-auto">
                    <pre className="text-sm text-pl-muted whitespace-pre-wrap break-words">
                      {prompts.get('validator')?.prompt_text || 'No prompt set'}
                    </pre>
                  </div>
                )}

                {prompts.get('validator') && (
                  <div className="text-xs text-pl-muted">
                    Last updated by {prompts.get('validator')?.updated_by} on{' '}
                    {new Date(prompts.get('validator')?.updated_at || '').toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="pl-card p-8 border border-pl-border max-w-2xl w-full space-y-6">
            <h2 className="text-2xl font-bold text-pl-gold">New Tagging Entry</h2>

            <div>
              <label className="block text-pl-gold font-semibold mb-2">Title</label>
              <input
                type="text"
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="Entry title"
                className="pl-input w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-pl-gold font-semibold mb-2">Source Text</label>
              <textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                placeholder="Paste the content to be tagged..."
                className="pl-input w-full h-64 p-4 font-mono text-sm"
              />
            </div>

            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowNewEntryModal(false);
                  setNewEntryTitle('');
                  setNewEntryText('');
                }}
                className="pl-btn-secondary"
              >
                Cancel
              </button>
              <button onClick={handleNewEntry} className="pl-btn-primary">
                Create Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
