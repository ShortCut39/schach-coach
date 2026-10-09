import 'i18next';
import type { defaultNS, resources } from './index';

// Typisierte Schlüssel: t('nav.analyse') wird vom Typecheck geprüft.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)['de'];
  }
}
