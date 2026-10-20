import { pageOf, pathToward } from './links';

describe('the paths through the forest', () => {
  it('leads right to music, down to about and left to the finds', () => {
    expect(pathToward('/', 'right')).toBe('/music');
    expect(pathToward('/', 'bottom')).toBe('/about');
    expect(pathToward('/', 'left')).toBe('/finds');
    expect(pathToward('/', 'top')).toBeNull();
  });

  it('leads home the way each section was entered, and nowhere else', () => {
    expect(pathToward('/music', 'left')).toBe('/');
    expect(pathToward('/music', 'right')).toBeNull();
    expect(pathToward('/about', 'top')).toBe('/');
    expect(pathToward('/finds', 'right')).toBe('/');
  });

  it('names the page the forest stands on', () => {
    expect(pageOf('/')).toBe('home');
    expect(pageOf('/about')).toBe('about');
    expect(pageOf('/nowhere')).toBe('home');
  });
});
