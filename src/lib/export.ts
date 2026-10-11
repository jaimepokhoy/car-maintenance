import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { listAllServiceRecords } from '@/db/service-records';
import { shopNames } from '@/db/shops';
import type { Db } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import { serviceHistoryCsv, toIsoDate, type HistoryCsvOptions } from '@/domain';

/**
 * Writes every service to a CSV in the cache folder and opens the share sheet,
 * so owners can save it to Files, email it or open it in a spreadsheet.
 * Returns false when this phone can't share files.
 */
export async function shareServiceHistory(
  db: Db,
  options: Omit<HistoryCsvOptions, 'shopName'>,
  dialogTitle: string,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const [vehicles, records, shops] = await Promise.all([
    listVehicles(db),
    listAllServiceRecords(db),
    shopNames(db),
  ]);
  // A byte-order mark makes Excel read accents (é, è) correctly.
  const csv = '﻿' + serviceHistoryCsv(vehicles, records, { ...options, shopName: (id) => shops.get(id) });

  const file = new File(Paths.cache, `service-history-${toIsoDate(new Date())}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle });
  return true;
}
