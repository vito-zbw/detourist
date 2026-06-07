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

// Regression: Apple's exporter numbers CSS classes per-file by first appearance,
// so on some days the body paragraphs are class p3 (not p2) with the "Day N"
// marker in p2. The parser must not depend on a specific class number.
const FIXTURE_P3_BODY = `
<html><body>
<p class="p1"><span class="s1"><div class='pageContainer'>
  <div class="pageHeader">Monday, May 13, 2024</div>
  <div class="assetGrid"><div id="A" class="gridItem"><img src="../Resources/CCC.HEIC" class="asset_image"/></div></div>
  <div class='title'></div><div class='bodyText'></span></p>
<p class="p2"><span class="s2">Day 4</span></p>
<p class="p3"><span class="s2">Busiest day so far.</span></p>
<p class="p3"><span class="s2"></span><br></p>
<p class="p3"><span class="s2">Visited the central market.</span></p>
<p class="p4"><span class="s2">Back to Bukit Bintang at night.</span></p>
<p class="p1"><span class="s1"></div></div></span></p>
</body></html>`;

describe('parseEntryHtml with per-file class variance', () => {
  const r = parseEntryHtml(FIXTURE_P3_BODY);
  it('captures body paragraphs regardless of class number (p3/p4)', () => {
    expect(r.photoFiles).toEqual(['CCC.HEIC']);
    expect(r.paragraphs).toEqual([
      'Busiest day so far.',
      'Visited the central market.',
      'Back to Bukit Bintang at night.',
    ]);
  });
});
