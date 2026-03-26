import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 12 / mid-range Android reference)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/** Scale a size relative to screen width */
export const wp = (size: number) => (SCREEN_WIDTH / BASE_WIDTH) * size;

/** Scale a size relative to screen height */
export const hp = (size: number) => (SCREEN_HEIGHT / BASE_HEIGHT) * size;

/**
 * Normalize font size — scales with screen width but clamps
 * so text doesn't grow too large on tablets or too small on tiny phones.
 */
export const nfs = (size: number): number => {
  const scaled = (SCREEN_WIDTH / BASE_WIDTH) * size;
  return Math.round(PixelRatio.roundToNearestPixel(Math.min(scaled, size * 1.25)));
};

/** Clamp a value between min and max */
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export { SCREEN_WIDTH, SCREEN_HEIGHT };
