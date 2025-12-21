import { getMedicationByName as dbGetMedicationByName } from '../db/data';
import type { Tool } from './index';

export interface GetMedicationByNameInput {
  name: string;
}

export interface GetMedicationByNameOutput {
  success: boolean;
  medication?: {
    id: string;
    name: string;
    activeIngredients: string[];
    dosageInstructions: string;
    hebrew?: {
      name?: string;
      activeIngredients?: string[];
      dosageInstructions?: string;
    };
  };
  error?: string;
}

export const getMedicationByNameTool: Tool = {
  name: 'getMedicationByName',
  description: 'Retrieves medication information by name (supports both English and Hebrew names). Returns medical information only: active ingredients and dosage instructions. Can search by exact or partial match in either language. This tool does NOT return stock availability or prescription requirements - use checkInventory or requiresPrescription tools for those.',
  execute: async (params: Record<string, unknown>): Promise<GetMedicationByNameOutput> => {
    const { name } = params;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return {
        success: false,
        error: 'Medication name is required and must be a non-empty string',
      };
    }

    const medication = dbGetMedicationByName(name);

    if (!medication) {
      return {
        success: false,
        error: `Medication "${name}" not found in the database`,
      };
    }

    return {
      success: true,
      medication: {
        id: medication.id,
        name: medication.name,
        activeIngredients: medication.activeIngredients,
        dosageInstructions: medication.dosageInstructions,
        hebrew: medication.hebrew,
      },
    };
  },
};
