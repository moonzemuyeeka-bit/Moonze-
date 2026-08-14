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
 */
export function LocationSelect({
  provinces,
  defaultProvinceId,
  defaultDistrictId,
  provinceError,
  districtError,
  required = true,
  districtRequired = false,
  labels = { province: "Province", district: "District" },
}: {
  provinces: ProvinceOption[];
  defaultProvinceId?: string | null;
  defaultDistrictId?: string | null;
  provinceError?: string[];
  districtError?: string[];
  required?: boolean;
  districtRequired?: boolean;
  labels?: { province: string; district: string };
}) {
  const [provinceId, setProvinceId] = React.useState(defaultProvinceId ?? "");
  const districts = provinces.find((province) => province.id === provinceId)?.districts ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field name="provinceId" label={labels.province} error={provinceError} required={required}>
        {(control) => (
          <NativeSelect
            {...control}
            value={provinceId}
            onChange={(event) => setProvinceId(event.target.value)}
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
        name="districtId"
        label={labels.district}
        error={districtError}
        required={districtRequired}
        hint={provinceId ? undefined : "Choose a province first"}
      >
        {(control) => (
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
        )}
      </Field>
    </div>
  );
}
