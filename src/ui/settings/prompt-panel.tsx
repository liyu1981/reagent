import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from '../../core/i18n';
import { useToast } from '../../core/i18n';

import { Button } from '../../primitives/button';

import { useReAgentConfig } from '../../core/hooks';

export function ReAgentPromptPanel() {
  const { config, update } = useReAgentConfig();
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const language = i18n.language?.startsWith('zh') ? 'Chinese' : 'English';
  const [value, setValue] = useState(config.systemPrompt.custom);

  useEffect(() => {
    setValue(config.systemPrompt.custom);
  }, [config.systemPrompt.custom]);

  const handleSave = () => {
    if (value.trim() === '') {
      update({ systemPrompt: { mode: 'default', custom: '' } });
      toast.success(t('agent.customPromptCleared'));
      return;
    }
    update({ systemPrompt: { mode: 'custom', custom: value } });
    toast.success(t('agent.customPromptSaved'));
  };

  const handleReset = () => {
    setValue('');
    update({ systemPrompt: { mode: 'default', custom: '' } });
    toast.success(t('agent.customPromptCleared'));
  };

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={t('agent.customPromptPlaceholder')}
        rows={8}
        spellCheck={false}
        className="min-h-32 w-full resize-y rounded-xl border border-input bg-background p-3 font-mono text-xs leading-5 outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <p className="text-xs text-muted-foreground">
        {t('agent.customPromptHint', { token: '{{language}}' })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={handleSave}>
          {t('agent.save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setValue(t('agent.systemPrompt', { language }))}
        >
          {t('agent.customPromptLoadDefault')}
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReset}>
          <RotateCcw />
          {t('agent.customPromptReset')}
        </Button>
      </div>
    </div>
  );
}
