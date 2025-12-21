import { getMedicationByNameTool } from './getMedicationByName';
import { checkInventoryTool } from './checkInventory';
import { requiresPrescriptionTool } from './requiresPrescription';

export interface Tool {
  name: string;
  description: string;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export const tools: Tool[] = [
  getMedicationByNameTool,
  checkInventoryTool,
  requiresPrescriptionTool,
];

export function getAvailableTools(): Tool[] {
  return [...tools];
}

export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }
  return tool.execute(params);
}

