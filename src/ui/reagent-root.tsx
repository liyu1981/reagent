import type { ComponentProps } from 'react';

import { cn } from '../lib/utils';

/**
 * ReAgent layout primitives. The foundation carries no visual style — only
 * `data-slot` hooks and a merged `className` — so consumers can restyle or
 * replace any layer. The preset `<ReAgent>` supplies the glass look.
 */

function ReAgentRoot({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="reagent-root" className={cn(className)} {...props} />;
}

export { ReAgentRoot };
