import sampleIconUrl from '../../assets/icons/sample-icon.svg';

export function createSampleIcon({ width = 20, height = 20, alt = 'icon' } = {}) {
  const img = document.createElement('img');
  img.src = sampleIconUrl;
  img.alt = alt;
  img.width = width;
  img.height = height;
  img.style.verticalAlign = 'middle';
  img.style.marginRight = '8px';
  return img;
}
