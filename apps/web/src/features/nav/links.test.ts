import { pageOf, pathToward } from './links';

describe('the paths through the forest', () => {
  it('leads left to music, down to about and right to the art', () => {
    expect(pathToward('/', 'left')).toBe('/music');
    expect(pathToward('/', 'bottom')).toBe('/about');
    expect(pathToward('/', 'right')).toBe('/art');
    expect(pathToward('/', 'top')).toBeNull();
  });

  it('leads home the way each section was entered, and nowhere else', () => {
    expect(pathToward('/music', 'right')).toBe('/');
    expect(pathToward('/music', 'left')).toBeNull();
    expect(pathToward('/about', 'top')).toBe('/');
    expect(pathToward('/art', 'left')).toBe('/');
  });

  it('names the page the forest stands on', () => {
    expect(pageOf('/')).toBe('home');
    expect(pageOf('/about')).toBe('about');
    expect(pageOf('/nowhere')).toBe('home');
  });
});
