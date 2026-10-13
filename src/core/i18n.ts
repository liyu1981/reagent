import { useReAgent } from './hooks';
import type { ReAgentMarkdown, ReAgentTheme, ReAgentTranslate } from './messages';

/**
 * ReAgent's own micro-i18n. It reads the translator supplied to
 * `<ReAgentProvider>` (which defaults to the English `DEFAULT_MESSAGES`), so
 * the package has no `react-i18next` dependency. Names mirror the hooks the
 * package used before extraction, keeping the call sites unchanged.
 */

export function useTranslation(): { t: ReAgentTranslate; i18n: { language: string } } {
  const { t, language } = useReAgent();
  return { t, i18n: { language } };
}

export function useToast(): {
  success: (message: string) => void;
  error: (message: string) => void;
} {
  const { notify } = useReAgent();
  return {
    success: (message: string) => notify(message, 'success'),
    error: (message: string) => notify(message, 'error'),
  };
}

export function useResolvedTheme(): ReAgentTheme {
  return useReAgent().theme;
}

export function useMarkdown(): ReAgentMarkdown | undefined {
  return useReAgent().renderMarkdown;
}
