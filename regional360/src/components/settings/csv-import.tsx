"use client";

import * as React from "react";
import { Upload, CheckCircle2, XCircle, AlertCircle, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DATASETS: Record<string, { fields: string[]; required: string[] }> = {
  "Sales data": { fields: ["ignore", "date", "amount", "salesperson", "product", "territory"], required: ["date", "amount"] },
  "Customer data": { fields: ["ignore", "account", "industry", "territory", "owner", "revenue"], required: ["account"] },
  "Pipeline data": { fields: ["ignore", "opportunity", "account", "value", "stage", "closeDate"], required: ["opportunity", "value"] },
  "Team data": { fields: ["ignore", "salesperson", "target", "actual", "territory"], required: ["salesperson", "target"] },
};

interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

function parseCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const split = (l: string) => l.split(",").map((c) => c.trim());
  const headers = lines.length ? split(lines[0]) : [];
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

export function CsvImport() {
  const [dataset, setDataset] = React.useState("Sales data");
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = React.useState<Record<number, string>>({});
  const [fileName, setFileName] = React.useState("");

  const config = DATASETS[dataset];

  const onFile = async (file: File) => {
    const text = await file.text();
    const p = parseCsv(text);
    setParsed(p);
    setFileName(file.name);
    // naive auto-map by header name
    const auto: Record<number, string> = {};
    p.headers.forEach((h, i) => {
      const match = config.fields.find((f) => f !== "ignore" && h.toLowerCase().includes(f.toLowerCase()));
      auto[i] = match ?? "ignore";
    });
    setMapping(auto);
  };

  // Validation
  const mappedFields = Object.values(mapping);
  const missingRequired = config.required.filter((r) => !mappedFields.includes(r));
  let invalidRows = 0;
  let duplicateRows = 0;
  if (parsed) {
    const seen = new Set<string>();
    const requiredCols = Object.entries(mapping)
      .filter(([, f]) => config.required.includes(f))
      .map(([i]) => Number(i));
    parsed.rows.forEach((row) => {
      const hasEmptyRequired = requiredCols.some((c) => !row[c] || row[c].length === 0);
      if (hasEmptyRequired) invalidRows++;
      const key = requiredCols.map((c) => row[c]).join("|");
      if (key && seen.has(key)) duplicateRows++;
      else seen.add(key);
    });
  }
  const total = parsed?.rows.length ?? 0;
  const validRows = total - invalidRows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data import (CSV)</CardTitle>
        <CardDescription>
          Upload a CSV, map its columns to Regional360 fields, and validate before importing.
          This MVP validates client-side; persistence arrives with the database layer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Dataset</label>
            <Select value={dataset} onValueChange={(v) => { setDataset(v); setMapping({}); }}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(DATASETS).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            {fileName || "Choose CSV file"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>
        </div>

        {!parsed && (
          <p className="text-sm text-muted-foreground">
            No file selected. Required fields for {dataset}:{" "}
            {config.required.map((r) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>)}
          </p>
        )}

        {parsed && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat icon={<CheckCircle2 className="h-4 w-4 text-success" />} label="Valid records" value={validRows} />
              <Stat icon={<XCircle className="h-4 w-4 text-destructive" />} label="Invalid records" value={invalidRows} />
              <Stat icon={<AlertCircle className="h-4 w-4 text-warning" />} label="Missing fields" value={missingRequired.length} />
              <Stat icon={<Copy className="h-4 w-4 text-muted-foreground" />} label="Duplicates" value={duplicateRows} />
            </div>

            {missingRequired.length > 0 && (
              <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                Map required field(s): {missingRequired.map((r) => <Badge key={r} variant="warning" className="mr-1">{r}</Badge>)}
              </div>
            )}

            <div className="rounded-lg border border-border">
              <div className="grid grid-cols-[1fr_1fr] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>CSV column</span>
                <span>Regional360 field</span>
              </div>
              <div className="divide-y divide-border">
                {parsed.headers.map((h, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr] items-center gap-2 px-3 py-2">
                    <span className="truncate text-sm">
                      {h} <span className="text-xs text-muted-foreground">· e.g. {parsed.rows[0]?.[i] ?? "—"}</span>
                    </span>
                    <Select value={mapping[i] ?? "ignore"} onValueChange={(v) => setMapping((m) => ({ ...m, [i]: v }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {config.fields.map((f) => (
                          <SelectItem key={f} value={f}>{f === "ignore" ? "— Ignore —" : f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <Button disabled={missingRequired.length > 0 || validRows === 0}>
              Import {validRows} valid record{validRows === 1 ? "" : "s"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
