/**
 * Map a product name/brand/category string onto one of the household categories.
 *
 * Deliberately a keyword model, not an LLM: the category set is fixed and small,
 * so a curated synonym table is instant, offline, free, and explainable. Barcode
 * lookups usually supply a category already, which short-circuits this entirely.
 */

export const HOUSE_CATEGORIES = [
  'Dairy',
  'Grains',
  'Spices',
  'Vegetables',
  'Fruits',
  'Meat & Fish',
  'Beverages',
  'Snacks',
  'Cleaning',
  'Personal Care',
  'Other',
] as const;

export type HouseCategory = (typeof HOUSE_CATEGORIES)[number];

/** Longest-match-wins: keywords are checked as whole words. */
const KEYWORDS: Record<Exclude<HouseCategory, 'Other'>, string[]> = {
  Dairy: [
    'milk', 'butter', 'cheese', 'yogurt', 'yoghurt', 'curd', 'cream', 'paneer',
    'ghee', 'buttermilk', 'custard', 'dahi', 'khoya',
  ],
  Grains: [
    'rice', 'flour', 'atta', 'wheat', 'bread', 'pasta', 'noodle', 'noodles',
    'oats', 'cereal', 'quinoa', 'barley', 'semolina', 'sooji', 'rava', 'poha',
    'dalia', 'millet', 'tortilla', 'couscous', 'cornmeal',
  ],
  Spices: [
    'salt', 'pepper', 'cumin', 'coriander', 'turmeric', 'chilli', 'chili',
    'masala', 'garam', 'cardamom', 'clove', 'cinnamon', 'nutmeg', 'paprika',
    'oregano', 'basil', 'thyme', 'rosemary', 'ginger', 'garlic', 'mustard seed',
    'fenugreek', 'asafoetida', 'saffron', 'bay leaf', 'curry powder',
  ],
  Vegetables: [
    'onion', 'tomato', 'potato', 'carrot', 'spinach', 'broccoli', 'cauliflower',
    'cabbage', 'cucumber', 'capsicum', 'pepper vegetable', 'lettuce', 'peas',
    'beans', 'brinjal', 'eggplant', 'okra', 'ladyfinger', 'gourd', 'pumpkin',
    'radish', 'beetroot', 'mushroom', 'corn', 'celery', 'zucchini', 'leek',
    'shallot', 'coriander leaves', 'mint',
  ],
  Fruits: [
    'apple', 'banana', 'orange', 'mango', 'grape', 'grapes', 'strawberry',
    'blueberry', 'raspberry', 'pineapple', 'watermelon', 'melon', 'peach',
    'pear', 'plum', 'kiwi', 'papaya', 'guava', 'pomegranate', 'lemon', 'lime',
    'avocado', 'cherry', 'apricot', 'fig', 'date', 'coconut',
  ],
  'Meat & Fish': [
    'chicken', 'beef', 'mutton', 'lamb', 'pork', 'bacon', 'ham', 'sausage',
    'fish', 'salmon', 'tuna', 'prawn', 'shrimp', 'crab', 'squid', 'egg',
    'eggs', 'turkey', 'duck', 'salami', 'meatball',
  ],
  Beverages: [
    'water', 'juice', 'soda', 'cola', 'tea', 'coffee', 'beer', 'wine', 'whisky',
    'vodka', 'rum', 'gin', 'drink', 'smoothie', 'lemonade', 'cider', 'sparkling',
    'energy drink', 'milkshake', 'lassi', 'coconut water',
  ],
  Snacks: [
    'chips', 'crisps', 'biscuit', 'cookie', 'cracker', 'chocolate', 'candy',
    'sweet', 'toffee', 'wafer', 'namkeen', 'bhujia', 'popcorn', 'nuts',
    'almond', 'cashew', 'peanut', 'pistachio', 'walnut', 'granola bar',
    'protein bar', 'instant noodles', 'gelatin', 'jam', 'honey', 'peanut butter',
  ],
  Cleaning: [
    'detergent', 'soap', 'bleach', 'disinfectant', 'cleaner', 'dishwash',
    'sponge', 'scrub', 'mop', 'floor', 'glass cleaner', 'toilet cleaner',
    'fabric softener', 'laundry', 'garbage bag', 'trash bag', 'air freshener',
    'tissue', 'paper towel', 'aluminium foil', 'cling film',
  ],
  'Personal Care': [
    'shampoo', 'conditioner', 'toothpaste', 'toothbrush', 'mouthwash', 'deodorant',
    'perfume', 'lotion', 'moisturiser', 'moisturizer', 'sunscreen', 'razor',
    'shaving', 'sanitary', 'tampon', 'diaper', 'nappy', 'cotton', 'bandage',
    'hand wash', 'face wash', 'body wash', 'oil', 'comb', 'nail',
  ],
};

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score every category by how many of its keywords appear as whole words, and
 * return the best. Falls back to 'Other'.
 */
export function categorize(input: {
  name?: string | null;
  brand?: string | null;
  /** OpenFoodFacts-style category string, often comma separated with `en:` prefixes. */
  categories?: string | null;
}): HouseCategory {
  const haystack = [input.name, input.brand, input.categories]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/en:/g, ' ');

  if (!haystack.trim()) return 'Other';

  let best: HouseCategory = 'Other';
  let bestScore = 0;

  for (const [category, words] of Object.entries(KEYWORDS) as [Exclude<HouseCategory, 'Other'>, string[]][]) {
    let score = 0;
    for (const word of words) {
      // Longer keywords are more specific, so weight them higher.
      const re = new RegExp(`(^|[^a-z])${escape(word)}([^a-z]|$)`);
      if (re.test(haystack)) score += word.length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}
