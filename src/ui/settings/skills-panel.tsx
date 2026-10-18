import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { newSkillId } from '../../core/config';
import { useReAgentConfig } from '../../core/hooks';
import { useToast, useTranslation } from '../../core/i18n';
import { BUILTIN_SKILLS } from '../../core/skill-registry';
import type { AgentSkillConfig } from '../../core/types';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { Input } from '../../primitives/input';
import { Label } from '../../primitives/label';
import { Switch } from '../../primitives/switch';

interface SkillDraft {
  id: string | null;
  name: string;
  description: string;
  content: string;
}

export function ReAgentSkillsPanel() {
  const { config, update } = useReAgentConfig();
  const { t } = useTranslation();
  const toast = useToast();
  const [draft, setDraft] = useState<SkillDraft | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const builtinDisabled = new Set(config.skillsDisabledBuiltins);

  const toggleBuiltin = (id: string, enabled: boolean) => {
    const next = new Set(config.skillsDisabledBuiltins);
    if (enabled) {
      next.delete(id);
    } else {
      next.add(id);
    }
    update({ skillsDisabledBuiltins: [...next] });
  };

  const openNew = () => {
    setPendingDeleteId(null);
    setDraft({ id: null, name: '', description: '', content: '' });
  };

  const openEdit = (skill: AgentSkillConfig) => {
    setPendingDeleteId(null);
    setDraft({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      content: skill.content,
    });
  };

  const closeEditor = () => setDraft(null);

  const handleSaveDraft = () => {
    if (draft === null) {
      return;
    }
    const name = draft.name.trim();
    if (name === '') {
      toast.error(t('agent.skillNameRequired'));
      return;
    }
    if (draft.id === null) {
      const next: AgentSkillConfig = {
        id: newSkillId(),
        name,
        description: draft.description.trim(),
        content: draft.content,
        enabled: true,
      };
      update({ skills: [...config.skills, next] });
    } else {
      update({
        skills: config.skills.map(skill =>
          skill.id === draft.id
            ? { ...skill, name, description: draft.description.trim(), content: draft.content }
            : skill,
        ),
      });
    }
    setDraft(null);
    toast.success(t('agent.skillsSaved'));
  };

  const handleDelete = (id: string) => {
    update({ skills: config.skills.filter(skill => skill.id !== id) });
    setPendingDeleteId(null);
    toast.success(t('agent.skillsSaved'));
  };

  const renderEditor = (title: string) => {
    if (draft === null) {
      return null;
    }
    return (
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{title}</p>
          <Button
            size="icon-xs"
            variant="ghost"
            onClick={closeEditor}
            aria-label={t('common.cancel')}
          >
            <X />
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reagent-skill-name">{t('agent.skillName')}</Label>
          <Input
            id="reagent-skill-name"
            value={draft.name}
            onChange={event => setDraft({ ...draft, name: event.target.value })}
            placeholder={t('agent.skillNamePlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reagent-skill-description">{t('agent.skillDescription')}</Label>
          <Input
            id="reagent-skill-description"
            value={draft.description}
            onChange={event => setDraft({ ...draft, description: event.target.value })}
            placeholder={t('agent.skillDescriptionPlaceholder')}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reagent-skill-content">{t('agent.skillContent')}</Label>
          <textarea
            id="reagent-skill-content"
            value={draft.content}
            onChange={event => setDraft({ ...draft, content: event.target.value })}
            placeholder={t('agent.skillContentPlaceholder')}
            rows={8}
            spellCheck={false}
            className="min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveDraft}>
            {t('agent.save')}
          </Button>
          <Button size="sm" variant="outline" onClick={closeEditor}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {BUILTIN_SKILLS.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('agent.skillsBuiltin')}
          </p>
          {BUILTIN_SKILLS.map(skill => (
            <div
              key={skill.id}
              className="flex items-start gap-3 rounded-xl border border-border/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {skill.name}
                  <Badge variant="outline">{t('agent.skillsBuiltinBadge')}</Badge>
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {skill.description}
                </p>
              </div>
              <Switch
                checked={!builtinDisabled.has(skill.id)}
                onCheckedChange={enabled => toggleBuiltin(skill.id, enabled)}
                aria-label={skill.name}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t('agent.skillsCustom')}
          </p>
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus />
            {t('agent.skillsAdd')}
          </Button>
        </div>

        {draft !== null && draft.id === null && renderEditor(t('agent.skillNewTitle'))}

        {config.skills.length === 0 && draft === null && (
          <p className="text-sm text-muted-foreground">{t('agent.skillsEmpty')}</p>
        )}

        {config.skills.map(skill => {
          if (draft !== null && draft.id === skill.id) {
            return <div key={skill.id}>{renderEditor(t('agent.skillEditTitle'))}</div>;
          }
          if (pendingDeleteId === skill.id) {
            return (
              <div key={skill.id} className="space-y-2 rounded-xl border border-destructive/40 p-3">
                <p className="text-sm text-muted-foreground">
                  {t('agent.skillDeleteDescription', { name: skill.name })}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(skill.id)}>
                    {t('agent.skillDelete')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPendingDeleteId(null)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            );
          }
          return (
            <div
              key={skill.id}
              className="flex items-start gap-3 rounded-xl border border-border/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{skill.name}</p>
                {skill.description !== '' && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {skill.description}
                  </p>
                )}
              </div>
              <Switch
                checked={skill.enabled}
                onCheckedChange={enabled =>
                  update({
                    skills: config.skills.map(candidate =>
                      candidate.id === skill.id ? { ...candidate, enabled } : candidate,
                    ),
                  })
                }
                aria-label={skill.name}
              />
              <Button size="icon-sm" variant="ghost" onClick={() => openEdit(skill)}>
                <Pencil />
                <span className="sr-only">{t('agent.skillEditTitle')}</span>
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setPendingDeleteId(skill.id)}>
                <Trash2 />
                <span className="sr-only">{t('agent.skillDelete')}</span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
