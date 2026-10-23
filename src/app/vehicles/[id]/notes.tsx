import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTenantNames } from '@/db/customer-links';
import { getServiceRecord, updateServiceNotes } from '@/db/service-records';
import type { Db } from '@/db/types';
import type { ServiceRecord } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';

/**
 * Edits the notes on a service record. A record the customer's shop logged
 * opens here when tapped: its work, date, reading and cost are the shop's and
 * stay read-only, but the notes are the customer's own.
 */
export default function ServiceNotesScreen() {
  const { record: recordId } = useLocalSearchParams<{ id: string; record: string }>();
  const load = useCallback(
    async (db: Db) => ({ record: await getServiceRecord(db, recordId), shops: await getTenantNames(db) }),
    [recordId],
  );
  const { data } = useDbQuery(load);

  if (!data?.record) return <ThemedView style={styles.flex} />;
  const shop = data.record.createdByTenantId ? data.shops.get(data.record.createdByTenantId) : undefined;
  return <NotesForm record={data.record} shopName={shop} />;
}

function NotesForm({ record, shopName }: { record: ServiceRecord; shopName?: string }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const [notes, setNotes] = useState(record.notes ?? '');

  async function save() {
    await updateServiceNotes(db, record.id, notes, new Date());
    router.back();
  }

  return (
    <FormScreen footer={<Button title={t('notesForm.save')} size="large" onPress={save} />}>
      <ThemedText type="bodyStrong">{record.itemIds.map((itemId) => t(`items.${itemId}`)).join(', ')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {[format.date(record.performedOn), format.distance(record.odometerKm)].join(' · ')}
      </ThemedText>
      {record.createdByTenantId ? (
        <ThemedText type="caption" themeColor="textSecondary">
          {t('notesForm.shopRecord', { shop: shopName ?? t('sharing.unknownShop') })}
        </ThemedText>
      ) : null}
      <TextField
        label={t('notesForm.notes')}
        value={notes}
        onChangeText={setNotes}
        multiline
        autoFocus
        placeholder={t('notesForm.placeholder')}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
