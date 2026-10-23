import { randomUUID } from "expo-crypto";
import * as Location from "expo-location";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Chip } from "@/components/chip";
import { Icon } from "@/components/icon";
import { IconButton } from "@/components/icon-button";
import { Screen, SectionLabel } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { YourShop } from "@/components/your-shop";
import { Spacing } from "@/constants/theme";
import {
  listSavedShops,
  saveShop,
  unsaveShop,
  type SavedShop,
} from "@/db/shops";
import { useDbQuery } from "@/hooks/use-db-query";
import { useFormat } from "@/hooks/use-format";
import { useShopProfile } from "@/hooks/use-tenant-shop";
import { useTheme } from "@/hooks/use-theme";
import { PLACES_KEY, searchNearbyShops, type NearbyShop } from "@/lib/places";

type SearchState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "needsPermission" }
  | { kind: "error" }
  | { kind: "done"; shops: NearbyShop[] };

function directionsUrl(shop: {
  name: string;
  placeId?: string;
  mapsUrl?: string;
}) {
  if (shop.mapsUrl) return shop.mapsUrl;
  const query = encodeURIComponent(shop.name);
  const place = shop.placeId ? `&query_place_id=${shop.placeId}` : "";
  return `https://www.google.com/maps/search/?api=1&query=${query}${place}`;
}

export default function ShopsScreen() {
  const shop = useShopProfile();
  return shop ? <YourShop shop={shop} /> : <ShopFinder />;
}

function ShopFinder() {
  const { t, i18n } = useTranslation();
  const db = useSQLiteContext();
  const theme = useTheme();
  const { data: saved = [], reload } = useDbQuery(listSavedShops);
  const [search, setSearch] = useState<SearchState>({ kind: "idle" });
  const [openOnly, setOpenOnly] = useState(false);
  const [ratedOnly, setRatedOnly] = useState(false);
  const nearby =
    search.kind === "done"
      ? search.shops.filter(
          (shop) =>
            (!openOnly || shop.openNow === true) &&
            (!ratedOnly || (shop.rating ?? 0) >= 4),
        )
      : [];

  const find = useCallback(
    async (askPermission: boolean) => {
      const permission = askPermission
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        setSearch({ kind: "needsPermission" });
        return;
      }
      setSearch({ kind: "searching" });
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = position.coords;
        const shops = await searchNearbyShops(
          { latitude, longitude },
          i18n.language,
        );
        setSearch({ kind: "done", shops });
      } catch (error) {
        console.warn("Shop search failed", error);
        setSearch({ kind: "error" });
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
    <Screen title={t("shops.title")}>
      <SectionLabel>{t("shops.mine")}</SectionLabel>
      {saved.length === 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t("shops.noneSaved")}
          </ThemedText>
        </Card>
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

      <SectionLabel>{t("shops.nearby")}</SectionLabel>
      {search.kind === "done" && search.shops.length > 0 ? (
        <View style={styles.filters}>
          <Chip
            label={t("shops.openNow")}
            selected={openOnly}
            onPress={() => setOpenOnly((on) => !on)}
          />
          <Chip
            label={t("shops.rated")}
            selected={ratedOnly}
            onPress={() => setRatedOnly((on) => !on)}
          />
        </View>
      ) : null}
      {!PLACES_KEY ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t("shops.notConfigured")}
          </ThemedText>
        </Card>
      ) : search.kind === "idle" || search.kind === "needsPermission" ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t("shops.locationNeeded")}
          </ThemedText>
          <Button
            title={t("shops.allowLocation")}
            icon={<Icon name="pin" size={18} color={theme.onAccent} />}
            onPress={() => find(true)}
          />
        </Card>
      ) : search.kind === "searching" ? (
        <Card style={styles.searching}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="small" themeColor="textSecondary">
            {t("shops.searching")}
          </ThemedText>
        </Card>
      ) : search.kind === "error" ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t("shops.error")}
          </ThemedText>
          <Button
            title={t("shops.retry")}
            variant="secondary"
            onPress={() => find(false)}
          />
        </Card>
      ) : nearby.length === 0 ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {search.shops.length === 0
              ? t("shops.empty")
              : t("shops.noneMatch")}
          </ThemedText>
        </Card>
      ) : (
        nearby.map((shop) => (
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
}: {
  phone?: string;
  directions: string;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={styles.actions}>
      {phone ? (
        <Button
          title={t("shops.call")}
          variant="secondary"
          size="small"
          icon={<Icon name="call" size={16} color={theme.text} />}
          onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)}
        />
      ) : null}
      <Button
        title={t("shops.directions")}
        variant="secondary"
        size="small"
        icon={<Icon name="directions" size={16} color={theme.text} />}
        onPress={() => Linking.openURL(directions)}
      />
    </View>
  );
}

function SavedShopCard({
  shop,
  onRemove,
}: {
  shop: SavedShop;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <View style={styles.badge}>
            <Icon name="bookmarked" size={12} color={theme.textSecondary} />
            <ThemedText type="caption" themeColor="textSecondary">
              {t("shops.myShop")}
            </ThemedText>
          </View>
          <ThemedText type="bodyStrong">{shop.name}</ThemedText>
          {shop.address ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {shop.address}
            </ThemedText>
          ) : null}
        </View>
        <IconButton
          icon="bookmarked"
          variant="outlined"
          accessibilityLabel={t("shops.remove")}
          onPress={onRemove}
        />
      </View>
      <ShopActions phone={shop.phone} directions={directionsUrl(shop)} />
    </Card>
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
      ? t("shops.rating", {
          rating: shop.rating.toFixed(1),
          count: shop.ratingCount ?? 0,
        })
      : null,
    t("shops.away", { distance: format.distance(shop.distanceKm) }),
  ].filter(Boolean);

  return (
    <Card>
      <View style={styles.titleRow}>
        <View style={styles.flex}>
          <ThemedText type="bodyStrong">{shop.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {details.join(" · ")}
            {shop.openNow !== undefined ? (
              <ThemedText
                type="caption"
                style={{
                  color: shop.openNow ? theme.successText : theme.textSecondary,
                }}
              >
                {` · ${shop.openNow ? t("shops.openNow") : t("shops.closed")}`}
              </ThemedText>
            ) : null}
          </ThemedText>
          {shop.address ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {shop.address}
            </ThemedText>
          ) : null}
        </View>
        <IconButton
          icon={saved ? "bookmarked" : "bookmark"}
          variant={saved ? "inverse" : "outlined"}
          accessibilityLabel={saved ? t("shops.saved") : t("shops.save")}
          accessibilityState={{ selected: saved }}
          onPress={onToggleSaved}
        />
      </View>
      <ShopActions phone={shop.phone} directions={directionsUrl(shop)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two + Spacing.one,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  searching: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + Spacing.one,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
