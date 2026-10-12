import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listSavedShops, saveShop, unsaveShop, type SavedShop } from '@/db/shops';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { useTheme } from '@/hooks/use-theme';
import { PLACES_KEY, searchNearbyShops, type NearbyShop } from '@/lib/places';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'needsPermission' }
  | { kind: 'error' }
  | { kind: 'done'; shops: NearbyShop[] };

function directionsUrl(shop: { name: string; placeId?: string; mapsUrl?: string }) {
  if (shop.mapsUrl) return shop.mapsUrl;
  const query = encodeURIComponent(shop.name);
  const place = shop.placeId ? `&query_place_id=${shop.placeId}` : '';
  return `https://www.google.com/maps/search/?api=1&query=${query}${place}`;
}

export default function ShopsScreen() {
  const { t, i18n } = useTranslation();
  const db = useSQLiteContext();
  const { data: saved = [], reload } = useDbQuery(listSavedShops);
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });

  const find = useCallback(
    async (askPermission: boolean) => {
      const permission = askPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        setSearch({ kind: 'needsPermission' });
        return;
      }
      setSearch({ kind: 'searching' });
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude, longitude } = position.coords;
        const shops = await searchNearbyShops({ latitude, longitude }, i18n.language);
        setSearch({ kind: 'done', shops });
      } catch (error) {
        console.warn('Shop search failed', error);
        setSearch({ kind: 'error' });
      }
    },
    [i18n.language],
  );

  // Search straight away only when location was already granted; otherwise
  // wait for the owner to tap "Allow location".
  useEffect(() => {
    if (!PLACES_KEY) return;
    Location.getForegroundPermissionsAsync().then((permission) => {
      if (permission.granted) find(false);
    });
  }, [find]);

  async function toggleSaved(shop: NearbyShop) {
    const existing = saved.find((s) => s.placeId === shop.placeId);
    if (existing) {
      await unsaveShop(db, existing.id, new Date());
    } else {
      await saveShop(
        db,
        randomUUID(),
        {
          placeId: shop.placeId,
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          latitude: shop.location.latitude,
          longitude: shop.location.longitude,
        },
        new Date(),
      );
    }
    reload();
  }

  return (
    <Screen title={t('shops.title')}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {t('shops.mine')}
      </ThemedText>
      {saved.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('shops.noneSaved')}
        </ThemedText>
      ) : (
        saved.map((shop) => (
          <SavedShopCard
            key={shop.id}
            shop={shop}
            onRemove={async () => {
              await unsaveShop(db, shop.id, new Date());
              reload();
            }}
          />
        ))
      )}

      <ThemedText type="smallBold" accessibilityRole="header">
        {t('shops.nearby')}
      </ThemedText>
      {!PLACES_KEY ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('shops.notConfigured')}
        </ThemedText>
      ) : search.kind === 'idle' || search.kind === 'needsPermission' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('shops.locationNeeded')}
          </ThemedText>
          <Button title={t('shops.allowLocation')} onPress={() => find(true)} />
        </>
      ) : search.kind === 'searching' ? (
        <View style={styles.searching}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            {t('shops.searching')}
          </ThemedText>
        </View>
      ) : search.kind === 'error' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {t('shops.error')}
          </ThemedText>
          <Button title={t('shops.retry')} onPress={() => find(false)} />
        </>
      ) : search.shops.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('shops.empty')}
        </ThemedText>
      ) : (
        search.shops.map((shop) => (
          <NearbyShopCard
            key={shop.placeId}
            shop={shop}
            saved={saved.some((s) => s.placeId === shop.placeId)}
            onToggleSaved={() => toggleSaved(shop)}
          />
        ))
      )}
    </Screen>
  );
}

function ShopActions({
  phone,
  directions,
  extra,
}: {
  phone?: string;
  directions: string;
  extra?: { label: string; onPress: () => void };
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const actions = [
    phone ? { label: t('shops.call'), onPress: () => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`) } : null,
    { label: t('shops.directions'), onPress: () => Linking.openURL(directions) },
    extra ?? null,
  ].filter((action): action is { label: string; onPress: () => void } => action !== null);

  return (
    <View style={styles.actions}>
      {actions.map((action) => (
        <Pressable key={action.label} accessibilityRole="button" onPress={action.onPress} hitSlop={Spacing.two}>
          <ThemedText type="smallBold" style={{ color: theme.tint }}>
            {action.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function SavedShopCard({ shop, onRemove }: { shop: SavedShop; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{shop.name}</ThemedText>
      {shop.address ? (
        <ThemedText type="small" themeColor="textSecondary">
          {shop.address}
        </ThemedText>
      ) : null}
      <ShopActions
        phone={shop.phone}
        directions={directionsUrl(shop)}
        extra={{ label: t('shops.remove'), onPress: onRemove }}
      />
    </ThemedView>
  );
}

function NearbyShopCard({
  shop,
  saved,
  onToggleSaved,
}: {
  shop: NearbyShop;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const theme = useTheme();
  const details = [
    shop.rating !== undefined
      ? t('shops.rating', { rating: shop.rating.toFixed(1), count: shop.ratingCount ?? 0 })
      : null,
    t('shops.away', { distance: format.distance(shop.distanceKm) }),
  ].filter(Boolean);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.titleRow}>
        <ThemedText type="smallBold" style={styles.name}>
          {shop.name}
        </ThemedText>
        {shop.openNow !== undefined ? (
          <ThemedText type="small" style={{ color: shop.openNow ? theme.success : theme.textSecondary }}>
            {shop.openNow ? t('shops.openNow') : t('shops.closed')}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {details.join(' · ')}
      </ThemedText>
      {shop.address ? (
        <ThemedText type="small" themeColor="textSecondary">
          {shop.address}
        </ThemedText>
      ) : null}
      <ShopActions
        phone={shop.phone}
        directions={directionsUrl(shop)}
        extra={{ label: saved ? t('shops.saved') : t('shops.save'), onPress: onToggleSaved }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
