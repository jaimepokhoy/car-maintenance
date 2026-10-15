import { SymbolView, type AndroidSymbol, type SymbolWeight } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { MaintenanceItemId } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

/** The app's icon vocabulary: SF Symbols on iOS, Material Symbols on Android. */
export const ICONS = {
  add: { ios: 'plus', android: 'add' },
  back: { ios: 'chevron.left', android: 'chevron_left' },
  forward: { ios: 'chevron.right', android: 'chevron_right' },
  down: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  check: { ios: 'checkmark', android: 'check' },
  close: { ios: 'xmark', android: 'close' },
  edit: { ios: 'pencil', android: 'edit' },
  info: { ios: 'info.circle', android: 'info' },
  list: { ios: 'list.bullet', android: 'list_alt' },
  car: { ios: 'car.fill', android: 'directions_car' },
  carOutline: { ios: 'car', android: 'directions_car' },
  shop: { ios: 'wrench.and.screwdriver.fill', android: 'car_repair' },
  settings: { ios: 'gearshape.fill', android: 'settings' },
  pin: { ios: 'mappin.and.ellipse', android: 'location_on' },
  call: { ios: 'phone.fill', android: 'call' },
  directions: { ios: 'arrow.triangle.turn.up.right.diamond.fill', android: 'directions' },
  bookmark: { ios: 'bookmark', android: 'bookmark_border' },
  bookmarked: { ios: 'bookmark.fill', android: 'bookmark' },
  bell: { ios: 'bell.fill', android: 'notifications' },
  receipt: { ios: 'doc.text.fill', android: 'receipt_long' },
  book: { ios: 'book.fill', android: 'menu_book' },
  export: { ios: 'square.and.arrow.up', android: 'ios_share' },
  speed: { ios: 'gauge.with.needle', android: 'speed' },
  // Maintenance items.
  oil: { ios: 'drop.fill', android: 'oil_barrel' },
  rotate: { ios: 'arrow.triangle.2.circlepath', android: 'autorenew' },
  brake: { ios: 'exclamationmark.brakesignal', android: 'disc_full' },
  brakeFluid: { ios: 'brakesignal', android: 'water_drop' },
  engine: { ios: 'engine.combustion.fill', android: 'filter_alt' },
  air: { ios: 'wind', android: 'air' },
  coolant: { ios: 'thermometer.medium', android: 'thermostat' },
  gears: { ios: 'gearshape.2.fill', android: 'settings' },
  spark: { ios: 'bolt.fill', android: 'electric_bolt' },
  battery: { ios: 'minus.plus.batteryblock.fill', android: 'battery_full' },
  batteryCharge: { ios: 'bolt.batteryblock.fill', android: 'battery_charging_full' },
  wiper: { ios: 'windshield.front.and.wiper', android: 'cleaning_services' },
} satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

/** The icon for each maintenance item, shared by every list that names one. */
export const ITEM_ICONS: Record<MaintenanceItemId, IconName> = {
  oil_change: 'oil',
  tire_rotation: 'rotate',
  brake_inspection: 'brake',
  brake_fluid: 'brakeFluid',
  engine_air_filter: 'engine',
  cabin_air_filter: 'air',
  coolant: 'coolant',
  transmission_fluid: 'gears',
  spark_plugs: 'spark',
  battery_12v: 'battery',
  hv_battery_check: 'batteryCharge',
  wiper_blades: 'wiper',
};

export function Icon({
  name,
  size = 20,
  color,
  weight = 'semibold',
}: {
  name: IconName;
  size?: number;
  color?: string;
  weight?: SymbolWeight;
}) {
  const theme = useTheme();
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color ?? theme.text}
      weight={weight}
      resizeMode="scaleAspectFit"
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
