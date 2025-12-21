export interface Medication {
  id: string;
  name: string;
  activeIngredients: string[];
  dosageInstructions: string;
  prescriptionRequired: boolean;
  stock: number;
  hebrew?: {
    name?: string;
    activeIngredients?: string[];
    dosageInstructions?: string;
  };
}

export const medications: Medication[] = [
  {
    id: 'med-001',
    name: 'Aspirin',
    activeIngredients: ['Acetylsalicylic acid'],
    dosageInstructions: 'Take 325-650 mg every 4-6 hours as needed. Maximum 4 grams per day. Take with food or water to reduce stomach irritation.',
    prescriptionRequired: false,
    stock: 150,
    hebrew: {
      name: 'אספירין',
      activeIngredients: ['חומצה אצטילסליצילית'],
      dosageInstructions: 'קח 325-650 מ"ג כל 4-6 שעות לפי הצורך. מקסימום 4 גרם ביום. קח עם אוכל או מים כדי להפחית גירוי בקיבה.',
    },
  },
  {
    id: 'med-002',
    name: 'Ibuprofen',
    activeIngredients: ['Ibuprofen'],
    dosageInstructions: 'Adults: 200-400 mg every 4-6 hours as needed. Maximum 1200 mg per day. Take with food or milk to reduce stomach upset.',
    prescriptionRequired: false,
    stock: 0,
    hebrew: {
      name: 'איבופרופן',
      activeIngredients: ['איבופרופן'],
      dosageInstructions: 'מבוגרים: 200-400 מ"ג כל 4-6 שעות לפי הצורך. מקסימום 1200 מ"ג ביום. קח עם אוכל או חלב כדי להפחית אי נוחות בקיבה.',
    },
  },
  {
    id: 'med-003',
    name: 'Amoxicillin',
    activeIngredients: ['Amoxicillin'],
    dosageInstructions: 'Take 250-500 mg three times daily, or as directed by your healthcare provider. Complete the full course even if symptoms improve.',
    prescriptionRequired: true,
    stock: 75,
    hebrew: {
      name: 'אמוקסיצילין',
      activeIngredients: ['אמוקסיצילין'],
      dosageInstructions: 'קח 250-500 מ"ג שלוש פעמים ביום, או לפי הוראות הרופא שלך. השלם את כל המנה גם אם התסמינים משתפרים.',
    },
  },
  {
    id: 'med-004',
    name: 'Metformin',
    activeIngredients: ['Metformin hydrochloride'],
    dosageInstructions: 'Take 500-1000 mg twice daily with meals, or as directed by your healthcare provider. Start with lower dose to minimize side effects.',
    prescriptionRequired: true,
    stock: 120,
    hebrew: {
      name: 'מטפורמין',
      activeIngredients: ['מטפורמין הידרוכלוריד'],
      dosageInstructions: 'קח 500-1000 מ"ג פעמיים ביום עם הארוחות, או לפי הוראות הרופא שלך. התחל במינון נמוך יותר כדי למזער תופעות לוואי.',
    },
  },
  {
    id: 'med-005',
    name: 'Paracetamol',
    activeIngredients: ['Paracetamol'],
    dosageInstructions: 'Take 500-1000 mg every 4-6 hours as needed. Maximum 4 grams per day. Do not exceed recommended dose.',
    prescriptionRequired: false,
    stock: 300,
    hebrew: {
      name: 'פאראצטמול',
      activeIngredients: ['פאראצטמול'],
      dosageInstructions: 'קח 500-1000 מ"ג כל 4-6 שעות לפי הצורך. מקסימום 4 גרם ביום. אל תחרוג מהמינון המומלץ.',
    },
  },
];

