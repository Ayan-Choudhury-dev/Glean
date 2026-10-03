import type { ImageSourcePropType } from 'react-native';

/**
 * Category artwork (3D objects) sourced from The Thiings Collection —
 * https://www.thiings.co/things — free-to-use AI-generated 3D icons.
 * Downscaled to 256² and bundled locally (see assets/images/categories/).
 */
export const CATEGORY_IMAGE: Record<string, ImageSourcePropType> = {
  Dairy: require('../assets/images/categories/dairy.png'),
  Grains: require('../assets/images/categories/grains.png'),
  Spices: require('../assets/images/categories/spices.png'),
  Vegetables: require('../assets/images/categories/vegetables.png'),
  Fruits: require('../assets/images/categories/fruits.png'),
  'Meat & Fish': require('../assets/images/categories/meat-fish.png'),
  Beverages: require('../assets/images/categories/beverages.png'),
  Snacks: require('../assets/images/categories/snacks.png'),
  Cleaning: require('../assets/images/categories/cleaning.png'),
  'Personal Care': require('../assets/images/categories/personal-care.png'),
  Other: require('../assets/images/categories/other.png'),
};

export function categoryImage(category: string): ImageSourcePropType | undefined {
  return CATEGORY_IMAGE[category];
}
