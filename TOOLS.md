# Tool Design Documentation

## Tool 1: getMedicationByName

**Purpose:** Retrieves medication information by name (English/Hebrew). Returns active ingredients and dosage instructions.

**Inputs:** `name` (string, required)

**Output:** `{ success: boolean; medication?: { id, name, activeIngredients, dosageInstructions, hebrew? }; error?: string }`

**Error Handling:** Empty name → error. Not found → error. Attempts partial matching (English/Hebrew) before failing.

**Fallback:** Partial matching on failure. If no match, returns error (agent asks for clarification).

---

## Tool 2: checkInventory

**Purpose:** Returns stock availability by medication ID. Returns stock count and status.

**Inputs:** `medicationId` (string, required)

**Output:** `{ success: boolean; id?: string; stock?: number; status?: 'IN_STOCK' | 'OUT_OF_STOCK'; error?: string }`

**Error Handling:** Empty ID → error. Not found → error. Status: `OUT_OF_STOCK` if stock = 0, `IN_STOCK` otherwise.

**Fallback:** Returns error if ID not found. Agent must call `getMedicationByName` first to resolve name to ID.

---

## Tool 3: requiresPrescription

**Purpose:** Returns whether medication requires prescription by medication ID. Returns boolean only.

**Inputs:** `medicationId` (string, required)

**Output:** `{ success: boolean; id?: string; prescriptionRequired?: boolean; error?: string }`

**Error Handling:** Empty ID → error. Not found → error.

**Fallback:** Returns error if ID not found. Agent must call `getMedicationByName` first to resolve name to ID.

---

## Usage Patterns

1. Medication Info: `getMedicationByName(name)`
2. Inventory: `getMedicationByName(name)` → `checkInventory(medicationId)`
3. Prescription: `getMedicationByName(name)` → `requiresPrescription(medicationId)`

**Error Recovery:** Agent informs user, asks for clarification, does not hallucinate, stays in current flow step.
