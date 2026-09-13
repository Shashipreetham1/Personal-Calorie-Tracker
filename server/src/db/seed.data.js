/**
 * Demo data catalogue.
 *
 * Kept separate from the seeding logic so the two can be read independently:
 * this file is data a nutritionist could check, seed.js is the code that
 * arranges it into three weeks of history.
 *
 * Nutrition figures are per the stated unit and are realistic rather than
 * exact. Micronutrient key sets deliberately DIFFER between foods — that is
 * what makes the Phase 6 micro report (which unnests JSONB and sums by key)
 * worth testing: a real user's data has ragged keys, not a fixed schema.
 */

/** The account a reviewer logs in with. Password must satisfy the signup rules. */
export const DEMO_USER = {
  email: 'demo@example.com',
  password: 'demo1234',
  name: 'Demo User',
};

/**
 * Two goals with different effective dates, so goal-vs-actual has a real step
 * in it: without a change mid-range the chart cannot demonstrate that the
 * correct dated goal is picked per day.
 */
export const DEMO_GOALS = [
  {
    daysAgo: 20,
    dailyCalories: 2200,
    proteinG: 140,
    carbsG: 240,
    fatG: 70,
    weightGoalKg: 78,
  },
  {
    // A cut: fewer calories, more protein. Applies from 9 days ago onward.
    daysAgo: 9,
    dailyCalories: 1900,
    proteinG: 160,
    carbsG: 175,
    fatG: 58,
    weightGoalKg: 74,
  },
];

/** Days (counting back from today) left with no entries at all — see seed.js. */
export const EMPTY_DAYS_AGO = [13, 4];

/**
 * @typedef {object} FoodTemplate
 * @property {string} name
 * @property {string} unit
 * @property {number} quantity
 * @property {number} calories  Total for the stated quantity.
 * @property {number} proteinG
 * @property {number} carbsG
 * @property {number} fatG
 * @property {Record<string, number>} micros
 */

/** @type {Record<'breakfast' | 'lunch' | 'dinner' | 'snacks', FoodTemplate[]>} */
export const FOODS = {
  breakfast: [
    { name: 'Poha with peanuts', unit: 'bowl', quantity: 1, calories: 270, proteinG: 7, carbsG: 48, fatG: 6,
      micros: { iron_mg: 2.4, sodium_mg: 320, fiber_g: 3.1 } },
    { name: 'Masala omelette', unit: 'serving', quantity: 2, calories: 320, proteinG: 22, carbsG: 4, fatG: 24,
      micros: { vitamin_d_ug: 2.2, vitamin_b12_ug: 1.1, selenium_ug: 30 } },
    { name: 'Idli with sambar', unit: 'pieces', quantity: 3, calories: 290, proteinG: 10, carbsG: 55, fatG: 3,
      micros: { iron_mg: 1.8, folate_ug: 65, sodium_mg: 480 } },
    { name: 'Oats with milk and banana', unit: 'bowl', quantity: 1, calories: 340, proteinG: 13, carbsG: 58, fatG: 7,
      micros: { calcium_mg: 280, potassium_mg: 520, fiber_g: 6.2, magnesium_mg: 90 } },
    { name: 'Paratha with curd', unit: 'pieces', quantity: 2, calories: 420, proteinG: 12, carbsG: 52, fatG: 18,
      micros: { calcium_mg: 190, sodium_mg: 540 } },
    { name: 'Upma', unit: 'bowl', quantity: 1, calories: 250, proteinG: 6, carbsG: 42, fatG: 7,
      micros: { sodium_mg: 410, fiber_g: 2.8 } },
  ],
  lunch: [
    { name: 'Dal tadka with rice', unit: 'plate', quantity: 1, calories: 520, proteinG: 18, carbsG: 82, fatG: 12,
      micros: { iron_mg: 3.6, folate_ug: 120, potassium_mg: 610, fiber_g: 8.4 } },
    { name: 'Rajma chawal', unit: 'plate', quantity: 1, calories: 560, proteinG: 20, carbsG: 88, fatG: 11,
      micros: { iron_mg: 4.1, fiber_g: 11.2, magnesium_mg: 110 } },
    { name: 'Grilled chicken salad', unit: 'bowl', quantity: 1, calories: 380, proteinG: 38, carbsG: 14, fatG: 18,
      micros: { vitamin_c_mg: 42, vitamin_b12_ug: 0.9, potassium_mg: 680, selenium_ug: 28 } },
    { name: 'Paneer bhurji with roti', unit: 'plate', quantity: 1, calories: 610, proteinG: 28, carbsG: 54, fatG: 30,
      micros: { calcium_mg: 480, vitamin_a_ug: 210, sodium_mg: 720 } },
    { name: 'Chole with bhature', unit: 'plate', quantity: 1, calories: 720, proteinG: 19, carbsG: 96, fatG: 28,
      micros: { iron_mg: 3.2, sodium_mg: 890, fiber_g: 9.1 } },
    { name: 'Veg thali', unit: 'plate', quantity: 1, calories: 640, proteinG: 22, carbsG: 92, fatG: 20,
      micros: { iron_mg: 3.9, calcium_mg: 240, vitamin_c_mg: 28, fiber_g: 10.5 } },
  ],
  dinner: [
    { name: 'Roti with mixed vegetables', unit: 'plate', quantity: 1, calories: 430, proteinG: 14, carbsG: 68, fatG: 11,
      micros: { iron_mg: 2.8, vitamin_a_ug: 340, fiber_g: 7.6 } },
    { name: 'Chicken curry with rice', unit: 'plate', quantity: 1, calories: 620, proteinG: 34, carbsG: 72, fatG: 20,
      micros: { iron_mg: 2.9, vitamin_b12_ug: 1.4, sodium_mg: 760, selenium_ug: 34 } },
    { name: 'Khichdi with ghee', unit: 'bowl', quantity: 1, calories: 450, proteinG: 15, carbsG: 70, fatG: 12,
      micros: { iron_mg: 2.2, magnesium_mg: 85, fiber_g: 5.4 } },
    { name: 'Grilled fish with quinoa', unit: 'plate', quantity: 1, calories: 520, proteinG: 40, carbsG: 44, fatG: 18,
      micros: { omega3_mg: 1200, vitamin_d_ug: 8.4, vitamin_b12_ug: 2.6, selenium_ug: 46 } },
    { name: 'Palak paneer with roti', unit: 'plate', quantity: 1, calories: 580, proteinG: 26, carbsG: 52, fatG: 29,
      micros: { calcium_mg: 520, iron_mg: 4.8, vitamin_a_ug: 720, folate_ug: 145 } },
    { name: 'Egg curry with rice', unit: 'plate', quantity: 1, calories: 540, proteinG: 24, carbsG: 66, fatG: 21,
      micros: { vitamin_d_ug: 3.1, vitamin_b12_ug: 1.6, iron_mg: 2.6 } },
  ],
  snacks: [
    { name: 'Masala chai with biscuits', unit: 'serving', quantity: 1, calories: 180, proteinG: 4, carbsG: 26, fatG: 7,
      micros: { calcium_mg: 120, sodium_mg: 95 } },
    { name: 'Roasted almonds', unit: 'pieces', quantity: 15, calories: 105, proteinG: 3.8, carbsG: 4, fatG: 9,
      micros: { vitamin_e_mg: 5.4, magnesium_mg: 48, fiber_g: 2.1 } },
    { name: 'Banana', unit: 'piece', quantity: 1, calories: 95, proteinG: 1.2, carbsG: 24, fatG: 0.4,
      micros: { potassium_mg: 420, vitamin_c_mg: 10, fiber_g: 3.1 } },
    { name: 'Greek yoghurt', unit: 'cup', quantity: 1, calories: 150, proteinG: 15, carbsG: 9, fatG: 5,
      micros: { calcium_mg: 190, vitamin_b12_ug: 0.8 } },
    { name: 'Samosa', unit: 'piece', quantity: 1, calories: 260, proteinG: 5, carbsG: 30, fatG: 13,
      micros: { sodium_mg: 420 } },
    { name: 'Protein shake', unit: 'scoop', quantity: 1, calories: 130, proteinG: 25, carbsG: 4, fatG: 1.5,
      micros: { calcium_mg: 160, magnesium_mg: 40 } },
  ],
};

/**
 * When each meal is eaten, and how likely it is to be logged at all.
 *
 * Breakfast is occasionally skipped and snacks often are, which is what a real
 * three weeks looks like — and it gives the meal-type filter something to
 * actually filter.
 */
export const MEAL_SCHEDULE = [
  { mealType: 'breakfast', hour: 8, minute: 30, probability: 0.9 },
  { mealType: 'lunch', hour: 13, minute: 15, probability: 1 },
  { mealType: 'dinner', hour: 20, minute: 30, probability: 1 },
  { mealType: 'snacks', hour: 17, minute: 0, probability: 0.65 },
  // A second snack some days, so one meal type can hold multiple rows per day.
  { mealType: 'snacks', hour: 11, minute: 0, probability: 0.3 },
];

/**
 * How entries claim to have been created. Weighted towards manual, with enough
 * of the others that the history screen's source icons are all exercised.
 */
export const SOURCE_WEIGHTS = [
  { source: 'manual', weight: 6 },
  { source: 'photo', weight: 2 },
  { source: 'chat', weight: 1 },
  { source: 'import', weight: 1 },
];
