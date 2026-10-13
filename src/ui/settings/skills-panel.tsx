import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { newSkillId } from '../../core/config';
import { useReAgentConfig } from '../../core/hooks';
import { useToast, useTranslation } from '../../core/i18n';
import { BUILTIN_SKILLS } from '../../core/skill-registry';
import type { AgentSkillConfig } from '../../core/types';
import { Badge } from '../../primitives/badge';
import { Button } from '../../primitives/button';
import { ConfirmDialog } from '../../primitives/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog';
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
  const [pendingDelete, setPendingDelete] = useState<AgentSkillConfig | null>(null);

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

  const openNew = () => setDraft({ id: null, name: '', description: '', content: '' });

  const openEdit = (skill: AgentSkillConfig) =>
    setDraft({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      content: skill.content,
    });

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

  const handleDelete = () => {
    if (pendingDelete === null) {
      return;
    }
    update({ skills: config.skills.filter(skill => skill.id !== pendingDelete.id) });
    setPendingDelete(null);
    toast.success(t('agent.skillsSaved'));
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
        {config.skills.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('agent.skillsEmpty')}</p>
        )}
        {config.skills.map(skill => (
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
            <Button size="icon-sm" variant="ghost" onClick={() => setPendingDelete(skill)}>
              <Trash2 />
              <span className="sr-only">{t('agent.skillDelete')}</span>
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={draft !== null} onOpenChange={open => !open && setDraft(null)}>
        <DialogContent className="thin-scrollbar max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draft?.id === null ? t('agent.skillNewTitle') : t('agent.skillEditTitle')}
            </DialogTitle>
          </DialogHeader>
          {draft !== null && (
            <div className="space-y-3">
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
                  rows={10}
                  spellCheck={false}
                  className="min-h-40 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveDraft}>{t('agent.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={open => !open && setPendingDelete(null)}
        title={t('agent.skillDeleteTitle')}
        description={t('agent.skillDeleteDescription', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('agent.skillDelete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}
