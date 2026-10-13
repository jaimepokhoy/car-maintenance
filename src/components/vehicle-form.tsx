import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";

import { Button } from "@/components/button";
import { PickerField } from "@/components/picker-field";
import { SegmentedControl } from "@/components/segmented-control";
import { TextField } from "@/components/text-field";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import {
  isValidVin,
  normalizeVin,
  parseWholeNumber,
  VEHICLE_MAKES,
  type Powertrain,
  type VehicleFormErrors,
  type VehicleFormValues,
} from "@/domain";
import { useFormat } from "@/hooks/use-format";
import { fetchModels } from "@/lib/vehicle-models";
import { decodeVin } from "@/lib/vin-decode";

type ModelLookup =
  | { state: "needsYear" | "loading" | "failed" | "none" }
  | { state: "loaded"; models: string[] };

/** Loads model names for the chosen make and year, so the model picker can suggest them. */
function useModelLookup(make: string, yearInput: string): ModelLookup {
  const year = parseWholeNumber(yearInput);
  const validYear = year !== null && year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null;
  const trimmedMake = make.trim();
  const key = trimmedMake && validYear !== null ? `${trimmedMake}|${validYear}` : null;
  const [result, setResult] = useState<{ key: string; lookup: ModelLookup }>();

  useEffect(() => {
    if (!trimmedMake || validYear === null) return;
    const requested = `${trimmedMake}|${validYear}`;
    let current = true;
    fetchModels(trimmedMake, validYear)
      .then((models) => {
        if (current) {
          setResult({
            key: requested,
            lookup: models.length ? { state: 'loaded', models } : { state: 'none' },
          });
        }
      })
      .catch((error) => {
        console.warn('Model lookup failed', error);
        if (current) setResult({ key: requested, lookup: { state: 'failed' } });
      });
    return () => {
      current = false;
    };
  }, [trimmedMake, validYear]);

  if (!key) return { state: 'needsYear' };
  return result?.key === key ? result.lookup : { state: 'loading' };
}

type DecodeMessage =
  | "vehicleForm.decodeFilled"
  | "vehicleForm.decodeNotFound"
  | "vehicleForm.decodeFailed";

/**
 * The add and edit vehicle form. `onSubmit` saves and returns nothing, or
 * returns the validation errors to show. The odometer field only shows when
 * adding; existing cars update it from their own screen.
 */
export function VehicleForm({
  initialValues,
  showOdometer,
  submitTitle,
  onSubmit,
  footer,
}: {
  initialValues: VehicleFormValues;
  showOdometer: boolean;
  submitTitle: string;
  onSubmit: (values: VehicleFormValues) => Promise<VehicleFormErrors | void>;
  footer?: ReactNode;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<VehicleFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [decodeMessage, setDecodeMessage] = useState<DecodeMessage | null>(
    null,
  );
  const canDecode = isValidVin(normalizeVin(values.vin));
  const models = useModelLookup(values.make, values.year);

  const set = (field: keyof VehicleFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const errorFor = (field: keyof VehicleFormValues) =>
    errors[field] ? t(`vehicleForm.errors.${errors[field]}`) : undefined;

  async function fillFromVin() {
    setDecoding(true);
    setDecodeMessage(null);
    try {
      const decoded = await decodeVin(normalizeVin(values.vin));
      if (!decoded) {
        setDecodeMessage("vehicleForm.decodeNotFound");
        return;
      }
      setValues((current) => ({
        ...current,
        year: decoded.year ?? current.year,
        make: decoded.make ?? current.make,
        model: decoded.model ?? current.model,
        powertrain: decoded.powertrain ?? current.powertrain,
      }));
      setDecodeMessage("vehicleForm.decodeFilled");
    } catch (error) {
      console.warn("VIN lookup failed", error);
      setDecodeMessage("vehicleForm.decodeFailed");
    } finally {
      setDecoding(false);
    }
  }

  async function submit() {
    setSaving(true);
    try {
      const result = await onSubmit(values);
      if (result) setErrors(result);
    } finally {
      setSaving(false);
    }
  }

  const powertrains: { value: Powertrain; label: string }[] = [
    { value: "gas", label: t("powertrain.gas") },
    { value: "hybrid", label: t("powertrain.hybrid") },
    { value: "ev", label: t("powertrain.ev") },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ThemedView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <TextField
            label={t("vehicleForm.vin")}
            value={values.vin}
            onChangeText={set("vin")}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            error={errorFor("vin")}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t("vehicleForm.vinHint")}
          </ThemedText>
          {canDecode ? (
            <Button
              title={
                decoding ? t("vehicleForm.decoding") : t("vehicleForm.decode")
              }
              onPress={fillFromVin}
              disabled={decoding}
            />
          ) : null}
          {decodeMessage ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t(decodeMessage)}
            </ThemedText>
          ) : null}
          <TextField
            label={t("vehicleForm.year")}
            value={values.year}
            onChangeText={set("year")}
            keyboardType="number-pad"
            maxLength={4}
            error={errorFor("year")}
          />
          <PickerField
            label={t("vehicleForm.make")}
            placeholder={t("vehicleForm.makePlaceholder")}
            value={values.make}
            onChange={(make) =>
              // A different make means the old model no longer applies.
              setValues((current) => ({
                ...current,
                make,
                model: make === current.make ? current.model : "",
              }))
            }
            options={VEHICLE_MAKES}
            error={errorFor("make")}
          />
          <PickerField
            label={t("vehicleForm.model")}
            placeholder={t("vehicleForm.modelPlaceholder")}
            value={values.model}
            onChange={set("model")}
            options={models.state === "loaded" ? models.models : []}
            loading={models.state === "loading"}
            hint={
              models.state === "loaded" || models.state === "loading"
                ? undefined
                : t(`vehicleForm.models.${models.state}`)
            }
            error={errorFor("model")}
          />
          <TextField
            label={t("vehicleForm.trim")}
            placeholder={t("vehicleForm.trimPlaceholder")}
            value={values.trim}
            onChangeText={set("trim")}
            autoCapitalize="words"
            maxLength={60}
          />
          <SegmentedControl
            label={t("vehicleForm.powertrain")}
            options={powertrains}
            value={values.powertrain}
            onChange={(powertrain) =>
              setValues((current) => ({ ...current, powertrain }))
            }
          />
          {showOdometer ? (
            <TextField
              label={t("vehicleForm.odometer", { unit: format.distanceUnit })}
              value={values.odometerKm}
              onChangeText={set("odometerKm")}
              keyboardType="number-pad"
              error={errorFor("odometerKm")}
            />
          ) : null}
          <TextField
            label={t("vehicleForm.nickname")}
            placeholder={t("vehicleForm.nicknamePlaceholder")}
            value={values.nickname}
            onChangeText={set("nickname")}
            maxLength={60}
          />

          <ThemedText
            type="smallBold"
            accessibilityRole="header"
            style={styles.section}
          >
            {t("vehicleForm.moreDetails")}
          </ThemedText>
          <TextField
            label={t("vehicleForm.licencePlate")}
            value={values.licencePlate}
            onChangeText={set("licencePlate")}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            error={errorFor("licencePlate")}
          />
          <TextField
            label={t("vehicleForm.tireSize")}
            placeholder={t("vehicleForm.tireSizePlaceholder")}
            value={values.tireSize}
            onChangeText={set("tireSize")}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t("vehicleForm.tireSizeHint")}
          </ThemedText>

          <Button title={submitTitle} onPress={submit} disabled={saving} />
          {footer}
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

export const EMPTY_VEHICLE_FORM: VehicleFormValues = {
  nickname: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  vin: "",
  powertrain: "gas",
  odometerKm: "",
  licencePlate: "",
  tireSize: "",
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  section: {
    marginTop: Spacing.two,
  },
});
