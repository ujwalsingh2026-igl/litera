import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui';
import {
  BookOpen,
  User,
  Sparkles,
  FileText,
  Plus,
} from 'lucide-react';
import { useApp } from '../../state';
import { documentService } from '../../services/documentService';
import type { DocumentType } from '../../types';

interface TemplateDesignerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TemplatePreset {
  id: string;
  name: string;
  description: string;
  type: DocumentType;
  icon: React.ReactNode;
  content: string;
}

const PRESET_TEMPLATES: TemplatePreset[] = [
  {
    id: 'novel_chapter',
    name: 'Standard Novel Chapter',
    description: 'Classic three-act scene outline with sensory beats, dialogue, and cliffhanger.',
    type: 'novel',
    icon: <BookOpen className="w-5 h-5 text-amber-600" />,
    content: `<h2>Chapter 1: The Threshold</h2>\n<p><strong>Setting:</strong> </p>\n<p><strong>Characters Present:</strong> </p>\n<hr/>\n<p>The rain began just as Julian reached the rusted iron gates...</p>\n<h3>Scene Goal</h3>\n<p>Establish narrative tension and introduce the primary conflict.</p>`,
  },
  {
    id: 'character_sheet',
    name: 'Character Profile Bible',
    description: 'Comprehensive character sheet: physical traits, core flaw, secret desire, and arc.',
    type: 'story',
    icon: <User className="w-5 h-5 text-blue-600" />,
    content: `<h2>Character Profile: [Character Name]</h2>\n<p><strong>Age:</strong> 28 | <strong>Role:</strong> Protagonist</p>\n<h3>Appearance & Demeanor</h3>\n<p>Sharp gaze, tailored coat, adjusts vintage brass watch when calculating.</p>\n<h3>Core Drive & Internal Flaw</h3>\n<ul>\n<li><strong>Desire:</strong> Uncover the missing cartography maps.</li>\n<li><strong>Flaw:</strong> Reluctant to trust allies due to past betrayal.</li>\n</ul>`,
  },
  {
    id: 'poetry_sonnet',
    name: 'Shakespearean Sonnet Structure',
    description: 'Fourteen-line sonnet layout with rhyming scheme (ABAB CDCD EFEF GG).',
    type: 'poem',
    icon: <Sparkles className="w-5 h-5 text-purple-600" />,
    content: `<h2>Sonnet Title</h2>\n<p><em>Form: Shakespearean Sonnet (iambic pentameter)</em></p>\n<hr/>\n<p>Line 1 (A)<br/>Line 2 (B)<br/>Line 3 (A)<br/>Line 4 (B)</p>\n<p>Line 5 (C)<br/>Line 6 (D)<br/>Line 7 (C)<br/>Line 8 (D)</p>\n<p><strong>Volta (The Turn):</strong><br/>Line 9 (E)<br/>Line 10 (F)<br/>Line 11 (E)<br/>Line 12 (F)</p>\n<p><strong>Couplet:</strong><br/>Line 13 (G)<br/>Line 14 (G)</p>`,
  },
  {
    id: 'screenplay_scene',
    name: 'Screenplay Scene Template',
    description: 'Industry standard scene heading, action block, character cues, and parentheticals.',
    type: 'script',
    icon: <FileText className="w-5 h-5 text-emerald-600" />,
    content: `<h2>INT. ARCHIVE ROOM - NIGHT</h2>\n<p>Dust motes dance in the amber glow of a desk lamp. JULIAN (30s) sifts through parchment scrolls.</p>\n<p style="text-align:center;"><strong>JULIAN</strong><br/><em>(whispering)</em><br/>It was here all along...</p>`,
  },
];

export const TemplateDesignerModal: React.FC<TemplateDesignerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { setActiveDocument, setCurrentView } = useApp();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplatePreset>(PRESET_TEMPLATES[0]);
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  const handleUseTemplate = async (template: TemplatePreset) => {
    const docTitle = customTitle.trim() || template.name;
    const freshDoc = await documentService.create(docTitle, template.type, template.content);
    setActiveDocument(freshDoc);
    setCurrentView('document');
    onClose();
  };

  const handleCreateCustomTemplate = async () => {
    if (!customTitle.trim()) return;
    const freshDoc = await documentService.create(
      customTitle.trim(),
      'blank',
      `<h2>${customTitle.trim()}</h2>\n<p>${customContent.replace(/\n/g, '<br/>') || 'Custom template initialized.'}</p>`
    );
    setActiveDocument(freshDoc);
    setCurrentView('document');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manuscript Template Studio & Designer" size="lg">
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 text-xs">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-2 border-b-2 font-semibold transition ${
              activeTab === 'presets'
                ? 'border-amber-600 text-amber-900 dark:text-amber-300'
                : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Built-In Literary Templates
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 border-b-2 font-semibold transition ${
              activeTab === 'custom'
                ? 'border-amber-600 text-amber-900 dark:text-amber-300'
                : 'border-transparent text-stone-500 hover:text-stone-900 dark:hover:text-stone-100'
            }`}
          >
            Design Custom Template
          </button>
        </div>

        {/* Tab 1: Presets */}
        {activeTab === 'presets' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PRESET_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => setSelectedTemplate(tmpl)}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    selectedTemplate.id === tmpl.id
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 shadow-xs'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shrink-0">
                    {tmpl.icon}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-stone-900 dark:text-stone-100">
                      {tmpl.name}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                      {tmpl.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Template Live Preview */}
            <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span>Template Preview: {selectedTemplate.name}</span>
                <span className="capitalize text-[10px] font-mono px-2 py-0.5 bg-stone-200 dark:bg-stone-700 rounded">
                  Format: {selectedTemplate.type}
                </span>
              </div>
              <div
                className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 text-xs font-serif text-stone-800 dark:text-stone-200 max-h-40 overflow-y-auto leading-relaxed"
                dangerouslySetInnerHTML={{ __html: selectedTemplate.content }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleUseTemplate(selectedTemplate)}
              >
                Spawn Manuscript from Template
              </Button>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Template Designer */}
        {activeTab === 'custom' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Template Name
              </label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Victorian Mystery Chapter Template"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-stone-700 dark:text-stone-300">
                Initial Template Structure & Outline
              </label>
              <textarea
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={5}
                placeholder="Enter section titles, character prompts, or chapter structure..."
                className="w-full p-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-900 dark:text-stone-100 font-mono outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateCustomTemplate}
                disabled={!customTitle.trim()}
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>Create & Launch Template</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
