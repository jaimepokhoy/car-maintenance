import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, StyleSheet, View } from "react-native";

import { Button } from "@/components/button";
import { Card, CardRow } from "@/components/card";
import { Icon } from "@/components/icon";
import { Screen, SectionLabel } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { Control, Radius, Spacing } from "@/constants/theme";
import {
  formatTimeOfDay,
  openingStatus,
  shopClock,
  weekdayName,
  weekSchedule,
  type OpeningStatus,
  type ShopClock,
} from "@/domain";
import type { TenantProfile } from "@/domain/brand";
import { useLocale } from "@/hooks/use-locale";
import { useTheme } from "@/hooks/use-theme";

const MINUTE = 60_000;

/** The wall clock now, updated every minute so "Open now" flips on time. */
function useClock(): ShopClock {
  const [clock, setClock] = useState(() => shopClock(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setClock(shopClock(new Date())), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return clock;
}

function directionsUrl(shop: TenantProfile): string | null {
  const query =
    shop.latitude !== null && shop.longitude !== null
      ? `${shop.latitude},${shop.longitude}`
      : shop.address;
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

/** A branded app's shops tab: the one shop whose app this is. */
export function YourShop({ shop }: { shop: TenantProfile }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useLocale();
  const clock = useClock();
  const status = openingStatus(shop.hours, clock);
  const directions = directionsUrl(shop);
  const logo = shop.brand.logoUrl;

  return (
    <Screen title={t("yourShop.title")}>
      <Card>
        <View style={styles.identity}>
          {logo ? (
            <View
              style={[
                styles.logo,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.border,
                },
              ]}
            >
              <Image
                source={{ uri: logo }}
                contentFit="contain"
                accessibilityLabel={t("yourShop.logo", { name: shop.name })}
                style={styles.flex}
              />
            </View>
          ) : null}
          <View style={styles.flex}>
            <ThemedText type="headline">{shop.name}</ThemedText>
            {shop.address ? (
              <ThemedText type="small" themeColor="textSecondary">
                {shop.address}
              </ThemedText>
            ) : null}
            <StatusLine status={status} clock={clock} />
          </View>
        </View>

        {shop.booking_url ? (
          <Button
            title={t("yourShop.book")}
            icon={<Icon name="receipt" size={18} color={theme.onAccent} />}
            onPress={() => Linking.openURL(shop.booking_url!)}
          />
        ) : null}
        <View style={styles.actions}>
          {shop.phone ? (
            <Button
              title={t("shops.call")}
              variant="secondary"
              size="small"
              icon={<Icon name="call" size={16} color={theme.text} />}
              onPress={() =>
                Linking.openURL(`tel:${shop.phone!.replace(/[^\d+]/g, "")}`)
              }
            />
          ) : null}
          {directions ? (
            <Button
              title={t("shops.directions")}
              variant="secondary"
              size="small"
              icon={<Icon name="directions" size={16} color={theme.text} />}
              onPress={() => Linking.openURL(directions)}
            />
          ) : null}
          {shop.website_url ? (
            <Button
              title={t("yourShop.website")}
              variant="secondary"
              size="small"
              icon={<Icon name="export" size={16} color={theme.text} />}
              onPress={() => Linking.openURL(shop.website_url!)}
            />
          ) : null}
        </View>
      </Card>

      <SectionLabel>{t("yourShop.hours")}</SectionLabel>
      {shop.hours && shop.hours.length > 0 ? (
        <Card variant="list">
          {weekSchedule(shop.hours).map((day, index, week) => {
            const today = day.day === clock.day;
            const type = today ? "smallStrong" : "small";
            return (
              <CardRow
                key={day.day}
                last={index === week.length - 1}
                style={styles.hoursRow}
              >
                <ThemedText type={type}>
                  {weekdayName(day.day, locale)}
                  {today ? (
                    <ThemedText
                      type="caption"
                      themeColor="textSecondary"
                    >{` · ${t("yourShop.today")}`}</ThemedText>
                  ) : null}
                </ThemedText>
                <ThemedText
                  type={type}
                  themeColor={day.windows.length ? "text" : "textSecondary"}
                  style={styles.times}
                >
                  {day.windows.length
                    ? day.windows
                        .map((w) =>
                          t("yourShop.window", {
                            opens: formatTimeOfDay(w.opens, locale),
                            closes: formatTimeOfDay(w.closes, locale),
                          }),
                        )
                        .join("\n")
                    : t("yourShop.closedAllDay")}
                </ThemedText>
              </CardRow>
            );
          })}
        </Card>
      ) : (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            {t("yourShop.noHours")}
          </ThemedText>
        </Card>
      )}
    </Screen>
  );
}

/** "Open now · closes at 6:00 p.m." or "Closed · opens Monday at 8:00 a.m.". */
function StatusLine({
  status,
  clock,
}: {
  status: OpeningStatus;
  clock: ShopClock;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useLocale();
  if (status.kind === "unknown") return null;

  const when = (change: "closes" | "opens", time: string, inDays: number) => {
    const day = inDays === 0 ? "Today" : inDays === 1 ? "Tomorrow" : "On";
    return t(`yourShop.${change}${day}`, {
      time: formatTimeOfDay(time, locale),
      day: weekdayName((clock.day + inDays) % 7, locale),
    });
  };
  const detail =
    status.kind === "open"
      ? status.closes === null
        ? t("yourShop.openAllDay")
        : when("closes", status.closes, status.closesInDays)
      : when("opens", status.opens, status.opensInDays);

  return (
    <ThemedText type="small" themeColor="textSecondary">
      <ThemedText
        type="smallStrong"
        style={{
          color: status.kind === "open" ? theme.successText : theme.text,
        }}
      >
        {status.kind === "open" ? t("yourShop.openNow") : t("yourShop.closed")}
      </ThemedText>
      {` · ${detail}`}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  identity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two + Spacing.one,
  },
  logo: {
    width: Control.touch,
    height: Control.touch,
    borderRadius: Radius.field,
    borderWidth: 1,
    padding: Spacing.one,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  hoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  times: {
    textAlign: "right",
  },
});
