"use client";

import * as React from "react";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import type { ProvinceOption } from "@/server/reference/queries";

/**
 * Province + district pair.
 *
 * Districts are filtered by the chosen province in the browser from data already
 * on the page, so changing province does not cost a round trip on a slow
 * connection.
 *
 * Works uncontrolled (the common case — the selects post `provinceId` and
 * `districtId` with the form) or controlled, which the onboarding wizard needs
 * because it keeps its answers in state across steps.
 */
export function LocationSelect({
  provinces,
  defaultProvinceId,
  defaultDistrictId,
  provinceId: controlledProvinceId,
  districtId: controlledDistrictId,
  onProvinceChange,
  onDistrictChange,
  provinceError,
  districtError,
  required = true,
  districtRequired = false,
  emitFields = true,
  labels = { province: "Province", district: "District" },
}: {
  provinces: ProvinceOption[];
  defaultProvinceId?: string | null;
  defaultDistrictId?: string | null;
  provinceId?: string;
  districtId?: string;
  onProvinceChange?: (provinceId: string) => void;
  onDistrictChange?: (districtId: string) => void;
  provinceError?: string | string[];
  districtError?: string | string[];
  required?: boolean;
  districtRequired?: boolean;
  /** Set false when the parent posts the values through its own inputs. */
  emitFields?: boolean;
  labels?: { province: string; district: string };
}) {
  const isControlled = controlledProvinceId !== undefined;
  const [internalProvinceId, setInternalProvinceId] = React.useState(defaultProvinceId ?? "");
  const provinceId = isControlled ? controlledProvinceId : internalProvinceId;
  const districts = provinces.find((province) => province.id === provinceId)?.districts ?? [];

  function handleProvinceChange(value: string) {
    if (!isControlled) setInternalProvinceId(value);
    onProvinceChange?.(value);
    // A district from the previous province would no longer be valid.
    onDistrictChange?.("");
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        name={emitFields ? "provinceId" : "provinceIdChoice"}
        label={labels.province}
        error={provinceError}
        required={required}
      >
        {(control) => (
          <NativeSelect
            {...control}
            value={provinceId}
            onChange={(event) => handleProvinceChange(event.target.value)}
          >
            <option value="">Select a province</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field
        name={emitFields ? "districtId" : "districtIdChoice"}
        label={labels.district}
        error={districtError}
        required={districtRequired}
        hint={provinceId ? undefined : "Choose a province first"}
      >
        {(control) =>
          isControlled ? (
            <NativeSelect
              {...control}
              value={controlledDistrictId ?? ""}
              disabled={districts.length === 0}
              onChange={(event) => onDistrictChange?.(event.target.value)}
            >
              <option value="">
                {districts.length === 0 ? "Select a province first" : "Select a district"}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <NativeSelect
              {...control}
              defaultValue={defaultDistrictId ?? ""}
              disabled={districts.length === 0}
              key={provinceId}
            >
              <option value="">
                {districts.length === 0 ? "Select a province first" : "Select a district"}
              </option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </NativeSelect>
          )
        }
      </Field>
    </div>
  );
}
