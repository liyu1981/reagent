import { guessMimeType } from './attachments';
import { getFileSystemTools, getOpfsRoot } from './tools';
import type { AgentToolDescriptor, ReAgentFileRef, ReAgentFileStore } from './types';

export interface OpfsFileStoreOptions {
  /** OPFS root override; defaults to the browser's origin-private root. */
  root?: FileSystemDirectoryHandle | null;
  /** Folder under the namespace; defaults to `uploads`. */
  folder?: string;
}

function newFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') {
    return 'file';
  }
  const extensionIndex = cleaned.lastIndexOf('.');
  if (extensionIndex <= 0 || extensionIndex === cleaned.length - 1) {
    return cleaned.slice(0, 80);
  }
  const extension = cleaned.slice(extensionIndex).slice(0, 16);
  const base = cleaned.slice(0, extensionIndex).slice(0, 80 - extension.length);
  return `${base}${extension}`;
}

function pathSegments(path: string): string[] {
  return path
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment !== '' && segment !== '.' && segment !== '..');
}

async function resolveDir(
  root: FileSystemDirectoryHandle,
  namespace: string,
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = await root.getDirectoryHandle(namespace, { create });
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create });
  }
  return dir;
}

/**
 * Store conversation attachments under `<opfs>/<namespace>/<folder>/`. The
 * returned refs carry a relative `path` so the built-in filesystem tools can
 * read the same files.
 */
export function createOpfsFileStore(
  namespace: string,
  options: OpfsFileStoreOptions = {},
): ReAgentFileStore {
  const folder = options.folder ?? 'uploads';

  async function root(): Promise<FileSystemDirectoryHandle> {
    const handle = options.root !== undefined ? options.root : await getOpfsRoot();
    if (handle === null) {
      throw new Error('The browser does not expose an Origin Private File System.');
    }
    return handle;
  }

  return {
    async put(file: File): Promise<ReAgentFileRef> {
      const handle = await root();
      const dir = await resolveDir(handle, namespace, [folder], true);
      const id = newFileId();
      const storedName = `${id}-${safeFileName(file.name)}`;
      const fileHandle = await dir.getFileHandle(storedName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();
      return {
        id,
        name: file.name,
        mimeType: file.type === '' ? guessMimeType(file.name) : file.type,
        size: file.size,
        path: `${folder}/${storedName}`,
      };
    },

    async get(ref: ReAgentFileRef): Promise<Blob> {
      if (ref.url !== undefined && ref.url !== '') {
        const response = await fetch(ref.url);
        if (!response.ok) {
          throw new Error(`Could not fetch "${ref.name}" (${response.status}).`);
        }
        return response.blob();
      }
      const handle = await root();
      const segments = pathSegments(ref.path ?? `${folder}/${ref.id}`);
      if (segments.length === 0) {
        throw new Error('The file has no path.');
      }
      const dir = await resolveDir(handle, namespace, segments.slice(0, -1), false);
      const fileHandle = await dir.getFileHandle(segments[segments.length - 1]);
      return fileHandle.getFile();
    },

    async remove(ref: ReAgentFileRef): Promise<void> {
      const handle = await root();
      const segments = pathSegments(ref.path ?? `${folder}/${ref.id}`);
      if (segments.length === 0) {
        return;
      }
      const dir = await resolveDir(handle, namespace, segments.slice(0, -1), false);
      await dir.removeEntry(segments[segments.length - 1]);
    },
  };
}

/** OPFS attachments plus the matching filesystem tool descriptors. */
export function createOpfsFiles(
  namespace: string,
  options: OpfsFileStoreOptions = {},
): { store: ReAgentFileStore; descriptors: AgentToolDescriptor[] } {
  return {
    store: createOpfsFileStore(namespace, options),
    descriptors: getFileSystemTools(namespace),
  };
}
