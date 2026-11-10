/** Requests mirror the ASP.NET Core PetCreate / PetEdit contracts. */
export type PetFormValues = {
  name: string;
  species: string;
  breed: string;
  sex: string;
  dateOfBirth: string;
};

export const emptyPet: PetFormValues = {
  name: '', species: '', breed: '', sex: 'UNKNOWN', dateOfBirth: '',
};

export type PetCreatePayload = {
  name: string;
  species: string;
  breed: string | null;
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  dateOfBirth: string | null;
  attributesJson: null;
};

export type PetEditPayload = {
  name: string;
  breed: string | null;
  dateOfBirth: string | null;
  attributesJson: string | null;
};

export class PetFormError extends Error {
  constructor(public field: keyof PetFormValues, message: string) {
    super(message);
    this.name = 'PetFormError';
  }
}

// Oracle's PETS name/species/breed columns use BYTE length semantics.
function trimmed(value: string, field: keyof PetFormValues, label: string, maxBytes: number, required = false): string {
  const text = value.trim();
  if (required && !text) throw new PetFormError(field, `${label} is required.`);
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new PetFormError(field, `${label} cannot exceed ${maxBytes} UTF-8 bytes.`);
  }
  return text;
}

/** Returns a UTC ISO timestamp at midnight, or null; never shifts a calendar birthday. */
export function birthDate(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new PetFormError('dateOfBirth', 'Enter a valid birth date.');
  const timestamp = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString().slice(0, 10) !== value) {
    throw new PetFormError('dateOfBirth', 'Enter a valid birth date.');
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (value > today) throw new PetFormError('dateOfBirth', 'Birth date cannot be in the future.');
  return timestamp.toISOString();
}

/** Accept Oracle DATE values without changing the original calendar date. */
export function dateInputValue(value: unknown): string {
  const input = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(input) ? input.slice(0, 10) : '';
}

export function createPetPayload(values: PetFormValues): PetCreatePayload {
  const name = trimmed(values.name, 'name', 'Name', 120, true);
  const species = trimmed(values.species, 'species', 'Species', 80, true);
  const breed = trimmed(values.breed, 'breed', 'Breed', 120);
  if (!['MALE', 'FEMALE', 'UNKNOWN'].includes(values.sex)) throw new PetFormError('sex', 'Choose a valid sex.');
  return {
    name, species, breed: breed || null,
    sex: values.sex as PetCreatePayload['sex'],
    dateOfBirth: birthDate(values.dateOfBirth),
    attributesJson: null,
  };
}

/** PATCH replaces birthday and attributes in the current API: preserve attributes. */
export function editPetPayload(values: Pick<PetFormValues, 'name' | 'breed' | 'dateOfBirth'>, attributes: unknown): PetEditPayload {
  const name = trimmed(values.name, 'name', 'Name', 120, true);
  const breed = trimmed(values.breed, 'breed', 'Breed', 120);
  const attributesJson = typeof attributes === 'string' && attributes.trim() ? attributes : null;
  return {name, breed: breed || null, dateOfBirth: birthDate(values.dateOfBirth), attributesJson};
}
