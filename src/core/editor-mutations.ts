/**
 * Bridge from the agent's write tools into the live EditorPage UI state.
 *
 * The agent must not touch backend APIs (create_page / update_page are
 * removed). Instead it mutates the open editor's own frontmatter and
 * content sections through this interface — changes land in the editor and
 * are only persisted when the user hits Save, so they are non-destructive.
 *
 * After a content mutation the agent calls `openReview()` to hand the diff
 * back to the user in the review dialog. The user's choice is written back
 * through `setContent`, so the agent can treat the change as submitted.
 */
import type { ReAgentSelection } from './types';

export interface EditorFrontMatter {
  title: string;
  slug: string;
  date: string;
  tags: string[];
  extra: Array<{ key: string; value: string }>;
  seo: {
    seo_title: string;
    description: string;
    keywords: string;
    og_image: string;
    canonical: string;
    noindex: boolean;
  };
}

export type FrontMatterPatch = Partial<EditorFrontMatter>;

export interface EditorMutationBridge {
  getFrontMatter: () => EditorFrontMatter;
  getFrontMatterYaml: () => string;
  setFrontMatter: (patch: FrontMatterPatch) => void;
  getContent: () => string;
  setContent: (markdown: string) => void;
  /** The live editor selection (whole blocks), or null when empty. */
  getSelection: () => ReAgentSelection | null;
  /** Stage a replacement for the current selection; `save` reviews it. */
  updateSelection: (markdown: string) => void;
  /** Open the before/after review dialog for the pending agent edit. */
  openReview: () => void;
  getCommitNote: () => string;
  setCommitNote: (note: string) => void;
}
