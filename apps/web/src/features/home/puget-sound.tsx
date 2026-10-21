import pugetSound from '@/assets/puget-sound/puget-sound.svg';
import vinylRadioStation from '@/assets/puget-sound/vinyl-radio-station.svg';

/**
 * Puget Sound, the music brand: the wordmark over «Vinyl Radio Station»,
 * both centred, as laid out in Figma, as wide as its box.
 */
export const PugetSound = ({ className = '' }: { className?: string }) => (
  <div
    role="img"
    aria-label="Puget Sound, Vinyl Radio Station"
    className={`flex flex-col items-center ${className}`}
  >
    <img alt="" src={pugetSound} className="block h-auto w-full" />
    {/* Its width and the gap above it are shares of the wordmark's width. */}
    <img
      alt=""
      src={vinylRadioStation}
      className="block h-auto"
      style={{ width: '89.07%', marginTop: '3.83%' }}
    />
  </div>
);
