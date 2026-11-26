import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const EXTENSIONS = ['.ts', '.tsx', '/index.ts'];

function withExtension(base) {
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) {
      return pathToFileURL(base + ext).href;
    }
  }
  return null;
}

// '@/lib/dates' -> <root>/lib/dates.ts; kengaytmasiz nisbiy importlarga ham .ts qo'shiladi.
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const url = withExtension(path.join(root, specifier.slice(2)));
    if (url !== null) {
      return next(url, context);
    }
  }
  if (/^\.\.?\//.test(specifier) && path.extname(specifier) === '' && context.parentURL?.startsWith('file:')) {
    const url = withExtension(path.join(path.dirname(fileURLToPath(context.parentURL)), specifier));
    if (url !== null) {
      return next(url, context);
    }
  }
  return next(specifier, context);
}
