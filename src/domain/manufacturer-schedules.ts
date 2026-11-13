import type { MaintenanceInterval, MaintenanceItemId, Powertrain, Vehicle } from './types';

/**
 * Manufacturer maintenance schedules for the makes most common on Canadian
 * roads. Values are the maker's normal-duty intervals (kilometres, months) as
 * published in its maintenance guide; severe use (towing, delivery, lots of
 * short winter trips) calls for shorter intervals, and a model or trim can
 * differ. The vehicle's owner can always override any interval, and the UI
 * labels these as the manufacturer's schedule rather than a guarantee.
 *
 * Only powertrains a maker sells here are listed. A make or powertrain with no
 * entry falls back to the general guidance in `schedules.ts`.
 */
export interface ManufacturerSchedule {
  label: string;
  source: string;
  powertrains: Partial<Record<Powertrain, MaintenanceInterval[]>>;
}

type IntervalSpec = Partial<Record<MaintenanceItemId, [everyKm?: number, everyMonths?: number]>>;

function intervals(spec: IntervalSpec): MaintenanceInterval[] {
  return (Object.entries(spec) as [MaintenanceItemId, [number?, number?]][]).map(
    ([itemId, [everyKm, everyMonths]]) => ({ itemId, everyKm, everyMonths }),
  );
}

/** A hybrid adds the high-voltage check to the maker's gas schedule. */
function withHybridCheck(base: IntervalSpec): MaintenanceInterval[] {
  return [...intervals(base), { itemId: 'hv_battery_check', everyMonths: 12 }];
}

const EV_ITEMS: IntervalSpec = {
  tire_rotation: [12_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 24],
  cabin_air_filter: [24_000, 12],
  coolant: [160_000, 120],
  battery_12v: [undefined, 12],
  hv_battery_check: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const TOYOTA: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [8_000, 12],
  brake_inspection: [16_000, 12],
  brake_fluid: [48_000, 36],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [16_000, 12],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [192_000, 144],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const HONDA: IntervalSpec = {
  oil_change: [12_000, 12],
  tire_rotation: [12_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [36_000, 36],
  engine_air_filter: [24_000, 24],
  cabin_air_filter: [24_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [160_000, 120],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const FORD: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [16_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 36],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [32_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [160_000, 120],
  spark_plugs: [160_000, 144],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const GM: IntervalSpec = {
  oil_change: [12_000, 12],
  tire_rotation: [12_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [undefined, 60],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [240_000, 60],
  transmission_fluid: [96_000, 96],
  spark_plugs: [97_000, 96],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const HYUNDAI: IntervalSpec = {
  oil_change: [12_000, 12],
  tire_rotation: [12_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [48_000, 48],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [96_000, 60],
  transmission_fluid: [96_000, 96],
  spark_plugs: [168_000, 120],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const NISSAN: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [8_000, 12],
  brake_inspection: [16_000, 12],
  brake_fluid: [24_000, 24],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [96_000, 60],
  transmission_fluid: [96_000, 96],
  spark_plugs: [168_000, 120],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const MAZDA: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [8_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [undefined, 24],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [120_000, 120],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const SUBARU: IntervalSpec = {
  oil_change: [10_000, 12],
  tire_rotation: [10_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [48_000, 36],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [220_000, 132],
  transmission_fluid: [96_000, 96],
  spark_plugs: [96_000, 96],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const VOLKSWAGEN: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [16_000, 12],
  brake_inspection: [30_000, 24],
  brake_fluid: [undefined, 24],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [32_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [80_000, 72],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const BMW: IntervalSpec = {
  oil_change: [12_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [undefined, 24],
  engine_air_filter: [60_000, 48],
  cabin_air_filter: [30_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [100_000, 96],
  spark_plugs: [100_000, 96],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const MERCEDES_BENZ: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [10_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 24],
  engine_air_filter: [60_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [96_000, 96],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const STELLANTIS: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [16_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 36],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [160_000, 144],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const MITSUBISHI: IntervalSpec = {
  oil_change: [12_000, 12],
  tire_rotation: [12_000, 12],
  brake_inspection: [24_000, 24],
  brake_fluid: [48_000, 48],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [96_000, 60],
  transmission_fluid: [96_000, 96],
  spark_plugs: [160_000, 120],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const VOLVO: IntervalSpec = {
  oil_change: [16_000, 12],
  tire_rotation: [16_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 24],
  engine_air_filter: [48_000, 48],
  cabin_air_filter: [24_000, 24],
  coolant: [160_000, 120],
  transmission_fluid: [96_000, 96],
  spark_plugs: [96_000, 96],
  battery_12v: [undefined, 12],
  wiper_blades: [undefined, 12],
};

const TESLA: IntervalSpec = {
  tire_rotation: [10_000, 12],
  brake_inspection: [20_000, 12],
  brake_fluid: [undefined, 24],
  cabin_air_filter: [undefined, 24],
  coolant: [160_000, 120],
  battery_12v: [undefined, 48],
  hv_battery_check: [undefined, 12],
  wiper_blades: [undefined, 12],
};

interface Entry {
  key: string;
  label: string;
  source: string;
  makes: readonly string[];
  gas?: IntervalSpec;
  hybrid?: IntervalSpec;
  ev?: IntervalSpec;
}

const ENTRIES: readonly Entry[] = [
  {
    key: 'toyota',
    label: 'Toyota',
    source: "Toyota Canada maintenance guide, normal duty",
    makes: ['Toyota', 'Lexus', 'Scion'],
    gas: TOYOTA,
    hybrid: TOYOTA,
    ev: EV_ITEMS,
  },
  {
    key: 'honda',
    label: 'Honda',
    source: 'Honda Canada maintenance schedule, normal duty',
    makes: ['Honda', 'Acura'],
    gas: HONDA,
    hybrid: HONDA,
    ev: EV_ITEMS,
  },
  {
    key: 'ford',
    label: 'Ford',
    source: 'Ford Canada scheduled maintenance, normal duty',
    makes: ['Ford', 'Lincoln'],
    gas: FORD,
    hybrid: FORD,
    ev: EV_ITEMS,
  },
  {
    key: 'gm',
    label: 'General Motors',
    source: 'GM Canada owner maintenance schedule, normal duty',
    makes: ['Chevrolet', 'GMC', 'Buick', 'Cadillac', 'Pontiac', 'Saturn', 'Oldsmobile'],
    gas: GM,
    hybrid: GM,
    ev: EV_ITEMS,
  },
  {
    key: 'hyundai',
    label: 'Hyundai',
    source: 'Hyundai Canada maintenance schedule, normal duty',
    makes: ['Hyundai', 'Kia', 'Genesis'],
    gas: HYUNDAI,
    hybrid: HYUNDAI,
    ev: EV_ITEMS,
  },
  {
    key: 'nissan',
    label: 'Nissan',
    source: 'Nissan Canada maintenance schedule, normal duty',
    makes: ['Nissan', 'Infiniti'],
    gas: NISSAN,
    hybrid: NISSAN,
    ev: EV_ITEMS,
  },
  {
    key: 'mazda',
    label: 'Mazda',
    source: 'Mazda Canada maintenance schedule, normal duty',
    makes: ['Mazda'],
    gas: MAZDA,
    hybrid: MAZDA,
    ev: EV_ITEMS,
  },
  {
    key: 'subaru',
    label: 'Subaru',
    source: 'Subaru Canada maintenance schedule, normal duty',
    makes: ['Subaru'],
    gas: SUBARU,
    hybrid: SUBARU,
    ev: EV_ITEMS,
  },
  {
    key: 'volkswagen',
    label: 'Volkswagen',
    source: 'Volkswagen Canada service schedule, normal duty',
    makes: ['Volkswagen', 'Audi'],
    gas: VOLKSWAGEN,
    hybrid: VOLKSWAGEN,
    ev: EV_ITEMS,
  },
  {
    key: 'bmw',
    label: 'BMW',
    source: 'BMW Canada Condition Based Service, normal duty',
    makes: ['BMW', 'MINI'],
    gas: BMW,
    hybrid: BMW,
    ev: EV_ITEMS,
  },
  {
    key: 'mercedes',
    label: 'Mercedes-Benz',
    source: 'Mercedes-Benz Canada service schedule, normal duty',
    makes: ['Mercedes-Benz', 'Smart'],
    gas: MERCEDES_BENZ,
    hybrid: MERCEDES_BENZ,
    ev: EV_ITEMS,
  },
  {
    key: 'stellantis',
    label: 'Stellantis',
    source: 'Ram, Dodge, Chrysler and Jeep Canada maintenance schedules, normal duty',
    makes: ['Ram', 'Dodge', 'Chrysler', 'Jeep', 'Fiat', 'Alfa Romeo', 'Maserati'],
    gas: STELLANTIS,
    hybrid: STELLANTIS,
    ev: EV_ITEMS,
  },
  {
    key: 'mitsubishi',
    label: 'Mitsubishi',
    source: 'Mitsubishi Canada maintenance schedule, normal duty',
    makes: ['Mitsubishi'],
    gas: MITSUBISHI,
    hybrid: MITSUBISHI,
    ev: EV_ITEMS,
  },
  {
    key: 'volvo',
    label: 'Volvo',
    source: 'Volvo Canada service schedule, normal duty',
    makes: ['Volvo', 'Polestar'],
    gas: VOLVO,
    hybrid: VOLVO,
    ev: EV_ITEMS,
  },
  {
    key: 'tesla',
    label: 'Tesla',
    source: 'Tesla owner maintenance schedule',
    makes: ['Tesla'],
    ev: TESLA,
  },
];

const BY_MAKE = new Map<string, Entry>();
for (const entry of ENTRIES) {
  for (const make of entry.makes) BY_MAKE.set(make.toLowerCase(), entry);
}

function specFor(entry: Entry, powertrain: Powertrain): MaintenanceInterval[] | undefined {
  if (powertrain === 'ev') return entry.ev ? intervals(entry.ev) : undefined;
  if (!entry.gas) return undefined;
  return powertrain === 'hybrid' ? withHybridCheck(entry.hybrid ?? entry.gas) : intervals(entry.gas);
}

/**
 * The maker's schedule for this vehicle's exact powertrain, or undefined when
 * the make isn't in the dataset or doesn't sell that powertrain here.
 */
export function manufacturerSchedule(
  vehicle: Pick<Vehicle, 'make' | 'powertrain'>,
): ManufacturerSchedule | undefined {
  const entry = BY_MAKE.get(vehicle.make.trim().toLowerCase());
  if (!entry) return undefined;
  const schedule = specFor(entry, vehicle.powertrain);
  if (!schedule) return undefined;
  return { label: entry.label, source: entry.source, powertrains: { [vehicle.powertrain]: schedule } };
}
