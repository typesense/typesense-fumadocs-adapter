import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { i18n } from './i18n';

export function baseOptions(): BaseLayoutProps {
  return {
    i18n,
    nav: {
      title: 'My App',
    },
  };
}
