import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { OpportunityBoardView } from '@/components/opportunities/OpportunityBoardView';

import { sampleBoard } from './fixtures';

describe('Phase 5 triage board view', () => {
  it('renders the sample board with four filters, five dimensions, and provenance', async () => {
    const board = await sampleBoard();
    const html = renderToStaticMarkup(
      <OpportunityBoardView
        board={board}
        activeState="all"
        onFilter={() => undefined}
        onToggleSaved={() => undefined}
        canSave={false}
      />,
    );

    expect(html).toContain('Roles you can inspect before applying.');
    expect(html).toContain('Captured snapshots · not live');
    expect(html).toContain('Sample candidate');
    expect(html).toContain('Finish intake');
    expect(html).toContain('Software Development Engineer Intern');
    expect(html).toContain('Apply while calibrating');
    expect(html).toContain('Prepare and revisit');
    expect(html).toContain('Boundary found');
    expect(html).toContain('Not assessed');
    expect(html).toContain('Declared skill overlap; not verified');
    expect(html).toContain('https://job-boards.greenhouse.io/hackerrank/jobs/8229735');
    expect(html).toContain('data-state="State_4"');
    expect(html).toContain('No application is submitted from this board.');
  });

  it('does not render an apply action, a verification badge, or a live claim', async () => {
    const board = await sampleBoard();
    const html = renderToStaticMarkup(
      <OpportunityBoardView
        board={board}
        activeState="all"
        onFilter={() => undefined}
        onToggleSaved={() => undefined}
        canSave={false}
      />,
    );

    expect(html).not.toContain('Submit application');
    expect(html).not.toContain('Apply now</button>');
    expect(html).not.toContain('Zero-Bond Verified');
    expect(html).not.toContain('Live data');
    expect(html).not.toContain('Save role');
    expect(html).toContain('Finish intake to save');
  });

  it('filters to State 3 without hiding the total counts', async () => {
    const board = await sampleBoard();
    const html = renderToStaticMarkup(
      <OpportunityBoardView
        board={board}
        activeState="State_3"
        onFilter={() => undefined}
        onToggleSaved={() => undefined}
        canSave={false}
      />,
    );

    expect(html).toContain('Forward Deployed Engineer');
    expect(html).not.toContain('Software Development Engineer Intern');
    expect(html).toContain('1 of 7 roles shown');
    expect(html).toContain('7 unique captured');
  });
});
