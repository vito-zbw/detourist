import { describe, it, expect } from 'vitest';
import { parseEntryHtml } from './parseEntry';

const FIXTURE = `
<html><body>
<p class="p1"><span class="s1"><div class='pageContainer'>
  <div class="pageHeader">Friday, May 10, 2024</div>
  <div class="assetGrid">
    <div id="A" class="gridItem assetType_livePhoto"><img src="../Resources/AAA.HEIC" class="asset_image"/></div>
    <div id="B" class="gridItem assetType_photo"><img src="../Resources/BBB.jpeg" class="asset_image"/></div>
  </div><div class='title'></div><div class='bodyText'></span></p>
<p class="p2"><span class="s2">DAY 1</span></p>
<p class="p2"><span class="s2">First paragraph with Marks &amp; Spencer.</span></p>
<p class="p3"><span class="s2"></span><br></p>
<p class="p2"><span class="s2">Second paragraph.</span></p>
<p class="p1"><span class="s1"></div></div></span></p>
</body></html>`;

describe('parseEntryHtml', () => {
  const r = parseEntryHtml(FIXTURE);
  it('extracts photo resource filenames in order', () => {
    expect(r.photoFiles).toEqual(['AAA.HEIC', 'BBB.jpeg']);
  });
  it('drops the DAY N marker and keeps cleaned paragraphs', () => {
    expect(r.paragraphs).toEqual([
      'First paragraph with Marks & Spencer.',
      'Second paragraph.',
    ]);
  });
});
