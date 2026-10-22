import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import GovernancePage from '@/app/(workspace)/governance/page';
import { NOT_CONNECTED_LABEL } from '@/lib/ux/copy';

describe('governance route', () => {
  it('renders an honest governance placeholder instead of a 404', () => {
    const html = renderToStaticMarkup(<GovernancePage />);

    expect(html).toContain('data-governance-page="true"');
    expect(html).toContain('Autonomy and consent');
    expect(html).toContain(NOT_CONNECTED_LABEL);
    expect(html).toContain('None of those controls are active in this build.');
    expect(html).toContain('who approved an action');
  });
});
