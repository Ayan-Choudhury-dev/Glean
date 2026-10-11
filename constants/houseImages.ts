import type { ImageSourcePropType } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';

/**
 * House display images.
 *
 * Artwork bundled locally in `assets/images/houses/`, sourced from
 * The Thiings Collection — https://www.thiings.co/things — free-to-use
 * AI-generated 3D icons. Downscaled to 256².
 *
 * Each preset has artwork in `source`; the `tint`/`icon` pair is the fallback
 * rendered while no artwork exists for a preset (or if one is removed).
 */
export type HouseImagePreset = {
  key: string;
  label: string;
  /** Artwork. When set, rendered instead of the tinted tile. */
  source?: ImageSourcePropType;
  tint: string;
  tintDark: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

export const HOUSE_IMAGES: HouseImagePreset[] = [
  {
    key: 'suburban',
    label: 'Suburban',
    source: require('../assets/images/houses/suburban.png'),
    tint: '#FFF7ED', tintDark: '#2A2018', icon: 'home-outline',
  },
  {
    key: 'cottage',
    label: 'Cottage',
    source: require('../assets/images/houses/cottage.png'),
    tint: '#FEF2F2', tintDark: '#2A1C1C', icon: 'home-outline',
  },
  {
    key: 'apartment',
    label: 'Apartment',
    source: require('../assets/images/houses/apartment.png'),
    tint: '#F7F7F7', tintDark: '#2A2A2A', icon: 'business-outline',
  },
  {
    key: 'flats',
    label: 'Modern flats',
    source: require('../assets/images/houses/flats.png'),
    tint: '#F5F3FF', tintDark: '#241B3A', icon: 'business-outline',
  },
  {
    key: 'hobbit-home',
    label: 'Hobbit home',
    source: require('../assets/images/houses/hobbit-home.png'),
    tint: '#ECFDF5', tintDark: '#0E2A22', icon: 'leaf-outline',
  },
  {
    key: 'mushroom-house',
    label: 'Mushroom house',
    source: require('../assets/images/houses/mushroom-house.png'),
    tint: '#FEF2F2', tintDark: '#2A1C1C', icon: 'home-outline',
  },
  {
    key: 'pavilion',
    label: 'Pavilion',
    source: require('../assets/images/houses/pavilion.png'),
    tint: '#EFF6FF', tintDark: '#12233D', icon: 'home-outline',
  },
  {
    key: 'container-home',
    label: 'Container home',
    source: require('../assets/images/houses/container-home.png'),
    tint: '#FFFBEB', tintDark: '#3A2A12', icon: 'home-outline',
  },
  {
    key: 'shell-house',
    label: 'Shell house',
    source: require('../assets/images/houses/shell-house.png'),
    tint: '#ECFEFF', tintDark: '#123035', icon: 'water-outline',
  },
  {
    key: 'greenhouse',
    label: 'Greenhouse',
    source: require('../assets/images/houses/greenhouse.png'),
    tint: '#ECFDF5', tintDark: '#0E2A22', icon: 'leaf-outline',
  },
  {
    key: 'living-room',
    label: 'Living room',
    source: require('../assets/images/houses/living-room.png'),
    tint: '#FFF7ED', tintDark: '#2A2018', icon: 'home-outline',
  },
];

export function houseImagePreset(key?: string | null): HouseImagePreset | undefined {
  if (!key) return undefined;
  return HOUSE_IMAGES.find(p => p.key === key);
}
