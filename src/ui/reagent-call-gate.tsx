import { X } from 'lucide-react';
import type { ComponentProps } from 'react';

import { useReAgent } from '../core/hooks';
import { useTranslation } from '../core/i18n';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';

/**
 * Where a host `beforeAgentCall` gate explains itself. Renders nothing while no
 * call is blocked. The host UI attached to the block runs inside the provider,
 * so it can finish its own flow (sign in, top up, …) and call
 * `useReAgent().send()` to retry the call.
 */
export function ReAgentCallGateNotice({ className, ...props }: ComponentProps<'div'>) {
  const { callBlock, clearCallBlock } = useReAgent();
  const { t } = useTranslation();
  if (callBlock === null) {
    return null;
  }
  return (
    <div
      data-slot="reagent-call-gate"
      role="status"
      className={cn(
        'mx-2 mb-2 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/60 px-3 py-2',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium">{t('agent.callBlocked')}</p>
        {callBlock.message !== undefined && callBlock.message !== '' && (
          <p className="text-xs text-muted-foreground">{callBlock.message}</p>
        )}
        {callBlock.ui !== undefined && callBlock.ui !== null && <div>{callBlock.ui}</div>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        onClick={clearCallBlock}
        aria-label={t('agent.dismiss')}
      >
        <X />
      </Button>
    </div>
  );
}
