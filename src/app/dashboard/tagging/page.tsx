'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface TaggingEntry {
  id: string;
  user_id: string;
  title: string;
  source_text: string;
  source_url?: string;
  screenshots?: string[];
  source_type?: 'text' | 'url' | 'mixed';
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

  const [newEntryUrl, setNewEntryUrl] = useState('');
  const [newEntryScreenshots, setNewEntryScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  // DB import state for tagging
  const [tagDbSearch, setTagDbSearch] = useState('');
  const [tagDbResults, setTagDbResults] = useState<{event_id:string;event_name_en:string;url:string;city:string}[]>([]);
  const [tagDbSearching, setTagDbSearching] = useState(false);

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

  // Inline subcategory add under a parent
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');
  const [newSubcatDomain, setNewSubcatDomain] = useState<'event' | 'attraction' | 'both'>('both');

  // Drag and drop
  const [dragItem, setDragItem] = useState<{ id: string; type: 'category' | 'tag'; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragContext, setDragContext] = useState<string | null>(null); // parent name or 'standalone' or 'tags' or tag section

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tagSections = ['Genre', 'Nationality', 'Broad Type', 'Attractions', 'Festive', 'Sports', 'Gaming'];
  const domains = ['event', 'attraction', 'both'] as const;

  const searchParams = useSearchParams();
  const autoFillDone = useRef(false);

  useEffect(() => {
    loadAllData();
  }, []);

  // Auto-fill new entry form when navigated from Events pipeline (Step B link)
  useEffect(() => {
    if (autoFillDone.current) return;
    const eventId = searchParams.get('event_id');
    const title = searchParams.get('title');
    const url = searchParams.get('url');
    if (eventId || title || url) {
      autoFillDone.current = true;
      if (title) setNewEntryTitle(title);
      if (url) setNewEntryUrl(url);
      setShowNewEntryModal(true);
    }
  }, [searchParams]);

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
    if (!newEntryTitle.trim()) {
      setError('Please provide a title');
      return;
    }
    if (!newEntryText.trim() && !newEntryUrl.trim()) {
      setError('Please provide source text or a URL');
      return;
    }

    try {
      setUploadingScreenshots(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');

      // Determine source type
      let sourceType: 'text' | 'url' | 'mixed' = 'text';
      if (newEntryUrl.trim() && newEntryText.trim()) sourceType = 'mixed';
      else if (newEntryUrl.trim()) sourceType = 'url';

      const { data, error: insertError } = await supabase
        .from('tagging_entries')
        .insert({
          user_id: session.user.id,
          title: newEntryTitle,
          source_text: newEntryText || '',
          source_url: newEntryUrl || null,
          source_type: sourceType,
          screenshots: [],
          status: 'draft',
          initial_result: null,
          validated_result: null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload screenshots if any
      if (newEntryScreenshots.length > 0) {
        const screenshotUrls = await uploadScreenshotsToStorage(data.id);
        const { error: updateError } = await supabase
          .from('tagging_entries')
          .update({ screenshots: screenshotUrls })
          .eq('id', data.id);
        if (updateError) throw updateError;
        data.screenshots = screenshotUrls;
      }

      setEntries([data, ...entries]);
      setNewEntryTitle('');
      setNewEntryText('');
      setNewEntryUrl('');
      setNewEntryScreenshots([]);
      setScreenshotPreviews([]);
      setShowNewEntryModal(false);
      calculateStats([data, ...entries]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    } finally {
      setUploadingScreenshots(false);
    }
  }

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + newEntryScreenshots.length > 5) {
      setError('Maximum 5 screenshots allowed');
      return;
    }
    const newFiles = [...newEntryScreenshots, ...files];
    setNewEntryScreenshots(newFiles);
    
    // Generate previews
    const newPreviews = [...screenshotPreviews];
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPreviews.push(reader.result as string);
        setScreenshotPreviews([...newPreviews]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeScreenshot = (index: number) => {
    setNewEntryScreenshots(prev => prev.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadScreenshotsToStorage = async (entryId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < newEntryScreenshots.length; i++) {
      const file = newEntryScreenshots[i];
      const fileName = `${entryId}/${Date.now()}_${i}_${file.name}`;
      const { data, error: uploadError } = await supabase.storage
        .from('tagging-screenshots')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('tagging-screenshots')
        .getPublicUrl(fileName);
      
      urls.push(urlData.publicUrl);
    }
    return urls;
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

  // Quick add subcategory under a parent
  const handleAddSubcategory = async (parentName: string) => {
    if (!newSubcatName.trim()) {
      setError('Subcategory name required');
      return;
    }

    try {
      const parentChildren = categories.filter(c => c.parent_group === parentName);
      const maxOrder = parentChildren.length > 0
        ? Math.max(...parentChildren.map(c => c.sort_order)) + 10
        : (categories.length + 1) * 10;

      const { data, error: insertError } = await supabase
        .from('tagging_taxonomy')
        .insert({
          type: 'category',
          name: newSubcatName,
          domain: newSubcatDomain,
          is_selectable: true,
          parent_group: parentName,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setCategories([...categories, data]);
      setNewSubcatName('');
      setNewSubcatDomain('both');
      setAddingSubcategoryTo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subcategory');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (id: string, type: 'category' | 'tag', index: number, context: string) => {
    setDragItem({ id, type, index });
    setDragContext(context);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverIndex(null);
    setDragContext(null);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number, context: string) => {
    e.preventDefault();
    if (!dragItem || dragContext !== context) {
      handleDragEnd();
      return;
    }

    const sourceIndex = dragItem.index;
    if (sourceIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    try {
      if (dragItem.type === 'category') {
        // Get the list of items in this context
        let itemsInContext: TaxonomyItem[];
        if (context === 'standalone') {
          itemsInContext = categories.filter(c => c.is_selectable && !c.parent_group);
        } else if (context === 'parents') {
          itemsInContext = categories.filter(c => !c.is_selectable && !c.parent_group);
        } else {
          // subcategories of a parent
          itemsInContext = categories.filter(c => c.parent_group === context);
        }

        const reordered = [...itemsInContext];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);

        // Update sort_orders
        const updates = reordered.map((item, idx) => ({
          id: item.id,
          sort_order: (idx + 1) * 10,
        }));

        // Optimistic update
        const updatedCategories = categories.map(c => {
          const update = updates.find(u => u.id === c.id);
          return update ? { ...c, sort_order: update.sort_order } : c;
        });
        updatedCategories.sort((a, b) => a.sort_order - b.sort_order);
        setCategories(updatedCategories);

        // Persist
        for (const update of updates) {
          await supabase
            .from('tagging_taxonomy')
            .update({ sort_order: update.sort_order, updated_at: new Date().toISOString() })
            .eq('id', update.id);
        }
      } else {
        // Tags - context is section name
        const sectionTags = tags.filter(t => t.section === context);
        const reordered = [...sectionTags];
        const [moved] = reordered.splice(sourceIndex, 1);
        reordered.splice(targetIndex, 0, moved);

        const updates = reordered.map((item, idx) => ({
          id: item.id,
          sort_order: (idx + 1) * 10,
        }));

        const updatedTags = tags.map(t => {
          const update = updates.find(u => u.id === t.id);
          return update ? { ...t, sort_order: update.sort_order } : t;
        });
        updatedTags.sort((a, b) => a.sort_order - b.sort_order);
        setTags(updatedTags);

        for (const update of updates) {
          await supabase
            .from('tagging_taxonomy')
            .update({ sort_order: update.sort_order, updated_at: new Date().toISOString() })
            .eq('id', update.id);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
    } finally {
      handleDragEnd();
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

  const GripIcon = () => (
    <svg className="w-4 h-4 text-pl-muted cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 20 20">
      <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z" />
    </svg>
  );

  const SmallPlusIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
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
                                                {/* Source URL */}
                        {entry.source_url && (
                          <div className="mb-4">
                            <label className="block text-pl-gold font-semibold mb-2">Source URL</label>
                            <a href={entry.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline break-all">
                              {entry.source_url}
                            </a>
                          </div>
                        )}

                        {/* Source Text */}
                        <div>
                          <label className="block text-pl-gold font-semibold mb-2">Source Text</label>
                          <div className="bg-pl-navy p-4 rounded border border-pl-border max-h-60 overflow-y-auto">
                            <p className="text-pl-muted whitespace-pre-wrap">{entry.source_text}</p>
                          
                        {/* Screenshots */}
                        {entry.screenshots && entry.screenshots.length > 0 && (
                          <div className="mt-4">
                            <label className="block text-pl-gold font-semibold mb-2">Screenshots ({entry.screenshots.length})</label>
                            <div className="flex gap-3 flex-wrap">
                              {entry.screenshots.map((url: string, idx: number) => (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt={`Screenshot ${idx + 1}`} className="w-32 h-32 object-cover rounded border border-pl-border hover:border-pl-gold transition-colors" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
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
                        {/* Parent Categories with Subcategories — shown FIRST */}
                        {parentCats.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-pl-muted mb-3 uppercase tracking-wider">Parent Categories</h3>
                            <div className="space-y-4">
                              {parentCats.map((parent, parentIdx) => (
                                <div
                                  key={parent.id}
                                  draggable
                                  onDragStart={() => handleDragStart(parent.id, 'category', parentIdx, 'parents')}
                                  onDragOver={(e) => handleDragOver(e, parentIdx)}
                                  onDrop={(e) => handleDrop(e, parentIdx, 'parents')}
                                  onDragEnd={handleDragEnd}
                                  className={`${dragContext === 'parents' && dragOverIndex === parentIdx ? 'border-t-2 border-pl-gold' : ''}`}
                                >
                                  <div className="pl-card p-4 border border-pl-border flex items-start justify-between bg-pl-navy/50">
                                    <div className="flex-1 flex items-center gap-3">
                                      <div className="flex-shrink-0 pt-1" title="Drag to reorder">
                                        <GripIcon />
                                      </div>
                                      <svg className="w-5 h-5 text-pl-gold flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                      </svg>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <h4 className="text-lg font-bold text-pl-gold">{parent.name}</h4>
                                          <span className="text-xs px-2 py-1 bg-pl-dark text-pl-muted rounded border border-pl-gold/30 font-semibold">
                                            [PARENT]
                                          </span>
                                          <span className="text-xs text-pl-muted">
                                            ({(childCatsMap.get(parent.name) || []).length})
                                          </span>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-2 inline-block border border-pl-accent/30">
                                          {parent.domain}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          setAddingSubcategoryTo(addingSubcategoryTo === parent.name ? null : parent.name);
                                          setNewSubcatName('');
                                          setNewSubcatDomain('both');
                                        }}
                                        className={`p-2 rounded transition ${addingSubcategoryTo === parent.name ? 'bg-pl-gold/20 text-pl-gold' : 'text-pl-success hover:bg-pl-success/10'}`}
                                        title="Add subcategory"
                                      >
                                        <SmallPlusIcon />
                                      </button>
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
                                  <div className="space-y-2 mt-2 ml-6 pl-4 border-l-2 border-pl-dark">
                                    {(childCatsMap.get(parent.name) || []).map((child, childIdx) => (
                                      <div
                                        key={child.id}
                                        draggable
                                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(child.id, 'category', childIdx, parent.name); }}
                                        onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, childIdx); }}
                                        onDrop={(e) => { e.stopPropagation(); handleDrop(e, childIdx, parent.name); }}
                                        onDragEnd={handleDragEnd}
                                        className={`pl-card p-3 border border-pl-border/50 flex items-center justify-between bg-pl-dark/30 transition-all ${
                                          dragContext === parent.name && dragOverIndex === childIdx ? 'border-t-2 border-pl-gold' : ''
                                        }`}
                                      >
                                        <div className="flex items-center gap-2 flex-1">
                                          <div className="flex-shrink-0" title="Drag to reorder">
                                            <GripIcon />
                                          </div>
                                          <div className="flex-1">
                                            <h5 className="font-semibold text-white text-sm">{child.name}</h5>
                                            <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-1 inline-block border border-pl-accent/30">
                                              {child.domain}
                                            </span>
                                          </div>
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

                                    {/* Inline add subcategory form */}
                                    {addingSubcategoryTo === parent.name && (
                                      <div className="pl-card p-3 border border-pl-gold/30 bg-pl-dark/50 space-y-2">
                                        <input
                                          type="text"
                                          placeholder="New subcategory name"
                                          value={newSubcatName}
                                          onChange={(e) => setNewSubcatName(e.target.value)}
                                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubcategory(parent.name); }}
                                          className="pl-input w-full text-sm"
                                          autoFocus
                                        />
                                        <div className="flex gap-2">
                                          <select
                                            value={newSubcatDomain}
                                            onChange={(e) => setNewSubcatDomain(e.target.value as 'event' | 'attraction' | 'both')}
                                            className="pl-input text-sm flex-1"
                                          >
                                            {domains.map(d => (
                                              <option key={d} value={d}>{d}</option>
                                            ))}
                                          </select>
                                          <button
                                            onClick={() => handleAddSubcategory(parent.name)}
                                            className="pl-btn-primary text-sm px-3"
                                          >
                                            Add
                                          </button>
                                          <button
                                            onClick={() => { setAddingSubcategoryTo(null); setNewSubcatName(''); }}
                                            className="pl-btn-secondary text-sm px-3"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Standalone Categories — shown after parents */}
                        {standaloneCats.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold text-pl-muted mb-3 uppercase tracking-wider">Standalone Categories</h3>
                            <div className="space-y-2">
                              {standaloneCats.map((cat, catIdx) => (
                                <div
                                  key={cat.id}
                                  draggable
                                  onDragStart={() => handleDragStart(cat.id, 'category', catIdx, 'standalone')}
                                  onDragOver={(e) => handleDragOver(e, catIdx)}
                                  onDrop={(e) => handleDrop(e, catIdx, 'standalone')}
                                  onDragEnd={handleDragEnd}
                                  className={`pl-card p-4 border border-pl-border flex items-center justify-between transition-all ${
                                    dragContext === 'standalone' && dragOverIndex === catIdx ? 'border-t-2 border-pl-gold' : ''
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex-shrink-0" title="Drag to reorder">
                                      <GripIcon />
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-white">{cat.name}</h4>
                                      <span className="text-xs px-2 py-1 bg-pl-accent/20 text-pl-accent-light rounded mt-2 inline-block border border-pl-accent/30">
                                        {cat.domain}
                                      </span>
                                    </div>
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
                  <h2 className="text-2xl font-bold text-pl-gold">Marketing Tags</h2>
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

                <div className="space-y-4">
                  {tagSections.map(section => {
                    const sectionTags = tags.filter(t => t.section === section);
                    if (sectionTags.length === 0) return null;
                    return (
                      <div key={section}>
                        <h3 className="text-xs font-semibold text-pl-muted mb-2 uppercase tracking-wider">{section} ({sectionTags.length})</h3>
                        <div className="space-y-1">
                          {sectionTags.map((tag, tagIdx) => (
                            <div
                              key={tag.id}
                              draggable
                              onDragStart={() => handleDragStart(tag.id, 'tag', tagIdx, section)}
                              onDragOver={(e) => handleDragOver(e, tagIdx)}
                              onDrop={(e) => handleDrop(e, tagIdx, section)}
                              onDragEnd={handleDragEnd}
                              className={`pl-card p-3 border border-pl-border flex items-center justify-between transition-all ${
                                dragContext === section && dragOverIndex === tagIdx ? 'border-t-2 border-pl-gold' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex-shrink-0" title="Drag to reorder">
                                  <GripIcon />
                                </div>
                                <h4 className="font-semibold text-white text-sm">{tag.name}</h4>
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
                    );
                  })}
                  {/* Tags with no matching section */}
                  {tags.filter(t => !tagSections.includes(t.section || '')).length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-pl-muted mb-2 uppercase tracking-wider">Other</h3>
                      <div className="space-y-1">
                        {tags.filter(t => !tagSections.includes(t.section || '')).map(tag => (
                          <div key={tag.id} className="pl-card p-3 border border-pl-border flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="flex-shrink-0"><GripIcon /></div>
                              <h4 className="font-semibold text-white text-sm">{tag.name}</h4>
                              <span className="text-xs px-2 py-0.5 bg-pl-gold/10 text-pl-gold rounded border border-pl-gold/30">{tag.section}</span>
                            </div>
                            <button onClick={() => handleDeleteTag(tag.id)} className="p-2 text-pl-warning hover:bg-pl-warning/10 rounded transition"><TrashIcon /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="pl-card p-8 border border-pl-border max-w-2xl w-full space-y-6 my-8">
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

            {/* DB Search */}
            <div>
              <label className="block text-pl-gold font-semibold mb-2">🗄️ Search from Database</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagDbSearch}
                  onChange={e => setTagDbSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (!tagDbSearch.trim()) return; setTagDbSearching(true); fetch(`/api/events-db?search=${encodeURIComponent(tagDbSearch)}&page=1`).then(r=>r.json()).then(d=>{ setTagDbResults(d.events||[]); setTagDbSearching(false); }).catch(()=>setTagDbSearching(false)); } }}
                  placeholder="Search event or attraction name…"
                  className="pl-input flex-1"
                />
                <button type="button" disabled={tagDbSearching}
                  onClick={() => { if (!tagDbSearch.trim()) return; setTagDbSearching(true); fetch(`/api/events-db?search=${encodeURIComponent(tagDbSearch)}&page=1`).then(r=>r.json()).then(d=>{ setTagDbResults(d.events||[]); setTagDbSearching(false); }).catch(()=>setTagDbSearching(false)); }}
                  className="px-4 py-2 bg-pl-gold text-black text-sm font-semibold rounded-lg hover:bg-pl-gold/80 disabled:opacity-50 transition-colors">
                  {tagDbSearching ? '…' : 'Search'}
                </button>
              </div>
              {tagDbResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1 border border-pl-border rounded-xl p-2 bg-black/20">
                  {tagDbResults.map(r => (
                    <button key={r.event_id} type="button"
                      onClick={() => { setNewEntryUrl(r.url || ''); setNewEntryTitle(r.event_name_en || ''); setTagDbResults([]); setTagDbSearch(''); }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-pl-gold/10 text-left transition-colors">
                      <span className="text-pl-gold font-mono text-xs px-1.5 py-0.5 bg-pl-gold/10 rounded shrink-0">#{r.event_id}</span>
                      <span className="text-sm text-white flex-1 truncate">{r.event_name_en}</span>
                      <span className="text-xs text-pl-muted shrink-0">{r.city}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-pl-gold font-semibold mb-2">Event/Attraction URL</label>
              <input
                type="url"
                value={newEntryUrl}
                onChange={(e) => setNewEntryUrl(e.target.value)}
                placeholder="https://platinumlist.net/event/..."
                className="pl-input w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Paste the Platinumlist event or attraction URL for live page scanning</p>
            </div>

            <div>
              <label className="block text-pl-gold font-semibold mb-2">Source Text</label>
              <textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                placeholder="Paste the page content to be tagged (or leave empty if URL provided)..."
                className="pl-input w-full h-48 p-4 font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-pl-gold font-semibold mb-2">Screenshots</label>
              <div className="border-2 border-dashed border-pl-border rounded-lg p-4">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleScreenshotUpload}
                  className="hidden"
                  id="screenshot-upload"
                />
                <label
                  htmlFor="screenshot-upload"
                  className="flex flex-col items-center cursor-pointer text-gray-400 hover:text-pl-gold transition-colors"
                >
                  <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">Click to upload screenshots (max 5)</span>
                </label>
              </div>
              {screenshotPreviews.length > 0 && (
                <div className="flex gap-3 mt-3 flex-wrap">
                  {screenshotPreviews.map((preview, idx) => (
                    <div key={idx} className="relative group">
                      <img src={preview} alt={`Screenshot ${idx + 1}`} className="w-20 h-20 object-cover rounded border border-pl-border" />
                      <button
                        onClick={() => removeScreenshot(idx)}
                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  setShowNewEntryModal(false);
                  setNewEntryTitle('');
                  setNewEntryText('');
                  setNewEntryUrl('');
                  setNewEntryScreenshots([]);
                  setScreenshotPreviews([]);
                }}
                className="pl-btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleNewEntry}
                className="pl-btn-primary"
                disabled={uploadingScreenshots}
              >
                {uploadingScreenshots ? 'Uploading...' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
