/**
 * Makes offered in the add-vehicle picker: brands sold new in Canada, plus
 * discontinued ones still common on Canadian roads. Owners can always type a
 * make that isn't listed. Spelled the way NHTSA's vPIC names them so model
 * lookups match.
 */
export const VEHICLE_MAKES: readonly string[] = [
  'Acura',
  'Alfa Romeo',
  'Aston Martin',
  'Audi',
  'Bentley',
  'BMW',
  'Buick',
  'Cadillac',
  'Chevrolet',
  'Chrysler',
  'Dodge',
  'Ferrari',
  'Fiat',
  'Ford',
  'Genesis',
  'GMC',
  'Honda',
  'Hummer',
  'Hyundai',
  'Infiniti',
  'Jaguar',
  'Jeep',
  'Kia',
  'Lamborghini',
  'Land Rover',
  'Lexus',
  'Lincoln',
  'Lotus',
  'Lucid',
  'Maserati',
  'Mazda',
  'McLaren',
  'Mercedes-Benz',
  'Mercury',
  'MINI',
  'Mitsubishi',
  'Nissan',
  'Oldsmobile',
  'Polestar',
  'Pontiac',
  'Porsche',
  'Ram',
  'Rivian',
  'Rolls-Royce',
  'Saab',
  'Saturn',
  'Scion',
  'Smart',
  'Subaru',
  'Suzuki',
  'Tesla',
  'Toyota',
  'Volkswagen',
  'Volvo',
];

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Options matching what the owner typed, ignoring case, accents, spaces and
 * dashes ("merc" finds Mercedes-Benz, "cx5" finds CX-5). Options that start
 * with the query come before ones that only contain it.
 */
export function filterOptions(options: readonly string[], query: string): string[] {
  const needle = fold(query);
  if (!needle) return [...options];
  const starts: string[] = [];
  const contains: string[] = [];
  for (const option of options) {
    const folded = fold(option);
    if (folded.startsWith(needle)) starts.push(option);
    else if (folded.includes(needle)) contains.push(option);
  }
  return [...starts, ...contains];
}

/** True when the query names one of the options exactly (ignoring case and punctuation). */
export function hasExactOption(options: readonly string[], query: string): boolean {
  const needle = fold(query);
  return options.some((option) => fold(option) === needle);
}
