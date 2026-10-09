import de from './de.json';

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [[prefix + key, value]] : leaves(value, `${prefix}${key}.`),
  );
}

describe('de.json', () => {
  it('enthält keine leeren Texte', () => {
    const empty = leaves(de as Tree).filter(([, value]) => value.trim() === '');
    expect(empty).toEqual([]);
  });
});
