import de from './de.json';
import en from './en.json';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[prefix + key, value]] : leaves(value, `${prefix}${key}.`),
  );
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe.each([
  ['de.json', de as Tree],
  ['en.json', en as Tree],
])('%s', (_name, tree) => {
  it('enthält keine leeren Texte', () => {
    expect(leaves(tree).filter(([, value]) => value.trim() === '')).toEqual([]);
  });
});

describe('Übersetzungen', () => {
  const german = new Map(leaves(de as Tree));
  const english = new Map(leaves(en as Tree));

  it('Englisch hat genau dieselben Schlüssel wie Deutsch', () => {
    expect([...english.keys()].filter((key) => !german.has(key))).toEqual([]);
    expect([...german.keys()].filter((key) => !english.has(key))).toEqual([]);
  });

  it('nutzt in jeder Sprache dieselben Platzhalter', () => {
    const mismatched = [...german].filter(
      ([key, text]) => placeholders(text).join() !== placeholders(english.get(key) ?? '').join(),
    );
    expect(mismatched.map(([key]) => key)).toEqual([]);
  });
});
