import { medications, type Medication } from './entites/medications';
// import { users } from './_data/users'; // Commented out - only used in commented functions below
import type { User } from './entites/users';

export type { Medication, User };

export function getAllMedications(): Medication[] {
  return [...medications];
}

export function getMedicationById(id: string): Medication | undefined {
  return medications.find((med) => med.id === id);
}

export function getMedicationByName(name: string): Medication | undefined {
  const normalizedName = name.toLowerCase().trim();

  const byEnglishName = medications.find((med) => med.name.toLowerCase() === normalizedName);
  if (byEnglishName) {
    return byEnglishName;
  }

  const byHebrewName = medications.find((med) =>
    med.hebrew?.name?.toLowerCase() === normalizedName
  );
  if (byHebrewName) {
    return byHebrewName;
  }

  const byPartialEnglish = medications.find((med) =>
    med.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(med.name.toLowerCase())
  );
  if (byPartialEnglish) {
    return byPartialEnglish;
  }

  const byPartialHebrew = medications.find((med) =>
    med.hebrew?.name?.toLowerCase().includes(normalizedName) ||
    (med.hebrew?.name && normalizedName.includes(med.hebrew.name.toLowerCase()))
  );
  if (byPartialHebrew) {
    return byPartialHebrew;
  }

  return undefined;
}

// Unused functions - commented out for potential future use
// export function searchMedications(query: string): Medication[] {
//   const normalizedQuery = query.toLowerCase().trim();
//   return medications.filter((med) =>
//     med.name.toLowerCase().includes(normalizedQuery)
//   );
// }

// export function getAllUsers(): User[] {
//   return [...users];
// }

// export function getUserById(id: string): User | undefined {
//   return users.find((user) => user.id === id);
// }
