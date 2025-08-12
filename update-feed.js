import fetch from 'node-fetch';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const sourceUrl = 'https://bazqux.com/feed/d3666864eb9248916165';
const outputFile = './feed.xml';

// Helper to safely get text content from XML element
function getText(elem) {
  if (!elem) return '';
  if (typeof elem === 'string') return elem;
  if (elem['#text']) return elem['#text'];
  return '';
}

async function main() {
  const res = await fetch(sourceUrl);
  const xmlText = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: 'gr:',
    preserveOrder: false,
    // parse tag content as is
  });
  const feed = parser.parse(xmlText);

  // The root is 'feed', with 'entry' array inside
  if (!feed.feed || !feed.feed.entry) {
    console.error('Invalid feed format');
    return;
  }

  const entries = Array.isArray(feed.feed.entry) ? feed.feed.entry : [feed.feed.entry];

  for (const entry of entries) {
    // Extract blog name from entry's source > title (e.g. "landinrris")
    let blogName = '';
    if (entry.source && entry.source.title) {
      blogName = getText(entry.source.title);
    }

    // Prepend blog name to entry title
    if (entry.title) {
      const origTitle = getText(entry.title);
      entry.title = `${blogName}: ${origTitle}`;
    }

    // Append tags as hashtags to summary HTML
    if (entry.category) {
      // category can be string or array
      let tags = [];
      if (Array.isArray(entry.category)) {
        tags = entry.category.map(c => (typeof c === 'string' ? c : c['gr:term'] || '')).filter(Boolean);
      } else if (typeof entry.category === 'string') {
        tags = [entry.category];
      } else if (entry.category['gr:term']) {
        tags = [entry.category['gr:term']];
      }

      if (entry.summary) {
        let summaryHtml = getText(entry.summary);
        const tagsHtml = tags.map(t => `<span>#${t.replace(/\s+/g, '')}</span>`).join(' ');
        if (tagsHtml) {
          summaryHtml += `<p>${tagsHtml}</p>`;
          entry.summary = summaryHtml;
        }
      }
    }
  }

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: 'gr:',
    format: true,
  });
  const newXml = builder.build(feed);

  await require('fs').promises.writeFile(outputFile, newXml);
  console.log(`Feed saved to ${outputFile}`);
}

main().catch(console.error);
