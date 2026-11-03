// SPDX-License-Identifier: MPL-2.0

/**
 * Spreadsheet formulas, evaluated on-device. Optional/additive (the engine minor
 * after 1.301): a tool feature-detects `host.calc`. See the `calc` field on
 * HostV1.
 */

/**
 * One cell value going in or coming out. `null` is an empty cell, text is a
 * string, and an error is `{ e: '#DIV/0!' }` (the same spelling Excel shows).
 */
export type CalcValueV1 = number | string | boolean | null | { e: string };

/** A cell of a sheet. `r` and `c` are 0-based (A1 is r 0, c 0). `f` is a formula without its leading `=`. A cell with `f` ignores `v`. */
export interface CalcCellV1 {
  r: number;
  c: number;
  v?: CalcValueV1;
  f?: string;
  /**
   * The formula was saved by a program without dynamic arrays (a file without the
   * dynamic-array mark). A range where one value is wanted is cut down to the cell in
   * the formula's own row or column, and the result never spills, as that program
   * read the formula. Leave unset for formulas typed in today's spreadsheets and tables.
   */
  legacy?: boolean;
}

export interface CalcSheetV1 {
  /** Sheet names are 1 to 31 characters, without `\ / ? * [ ] :`, and unique ignoring case. Formulas refer to them as `Name!A1`. */
  name: string;
  cells: CalcCellV1[];
}

/**
 * The clock and random seed volatile functions read. Both come from the caller,
 * never from the module, so the same request and clock always give the same
 * values. `now` is milliseconds since the Unix epoch (UTC).
 */
export interface CalcClockV1 {
  now: number;
  seed: number;
}

export interface CalcRequestV1 {
  sheets: CalcSheetV1[];
  /** The workbook uses the 1904 date system (some Mac-made files do). */
  date1904?: boolean;
  /** Omit for the live clock and a fresh seed. Pass a previous result's `clock` to reproduce it exactly. */
  clock?: CalcClockV1;
}

export interface CalcResultCellV1 {
  r: number;
  c: number;
  v: CalcValueV1;
  /** The formula itself calls a volatile function (NOW, TODAY, RAND, RANDBETWEEN, RANDARRAY, OFFSET, INDIRECT, INFO or CELL). */
  vol?: true;
  /** The value came from a dynamic array that spilled into this cell. */
  spill?: true;
  /** The formula text could not be parsed. `v` is `#NAME?`. */
  bad?: string;
}

export interface CalcResultV1 {
  /** One entry per request sheet, in order: every formula cell, then every spilled cell. */
  sheets: { cells: CalcResultCellV1[] }[];
  /** Some formula calls a volatile function, so the values would differ at another clock or seed. */
  volatile: boolean;
  /** Formulas that sit in a circular reference. */
  circular: number;
  /** The clock and seed this evaluation read. Keep it with the values to freeze them. */
  clock: CalcClockV1;
}

/** A table input's value: a header row and string rows. */
export interface CalcTableV1 {
  columns: string[];
  rows: string[][];
}

export interface CalcTableResultV1 {
  /** The table with every `=` cell replaced by its value as text. The header and every other cell are untouched. */
  table: CalcTableV1;
  /** The raw values of the computed cells. */
  values: { row: number; col: number; v: CalcValueV1 }[];
  /** Cells whose formula gave an error, as 0-based row and column in `table.rows`, with the error text. */
  errors: { row: number; col: number; error: string }[];
  /** Cells that held a formula. */
  formulas: number;
  volatile: boolean;
  clock: CalcClockV1;
}

export interface CalcFunctionV1 {
  name: string;
  min: number;
  /** Absent for a function that takes any number of arguments. */
  max?: number;
  category: string;
  volatile?: true;
}

/**
 * The formula engine. Runs locally; nothing is uploaded.
 *
 * Volatile functions stay live: each call without a `clock` reads the current
 * time and a fresh seed. A tool that exports what the user saw keeps the result
 * (its `clock` with the values) and exports those values; it never evaluates
 * again at export time, which would read a different clock.
 */
export interface CalcAPI {
  /** Evaluate sheets of cells. Refuses (rejects) a request over the size limits or with an invalid sheet name. A formula that cannot be parsed is reported on its cell, not thrown. */
  evaluate(request: CalcRequestV1): Promise<CalcResultV1>;
  /**
   * Evaluate a `table` input in which a cell starting with `=` is a formula. The
   * header row is row 1, so the first data row is row 2 and `=B2*C2` refers to
   * that row's second and third columns. Cells that read as plain numbers count as
   * numbers.
   */
  table(table: CalcTableV1, options?: { clock?: CalcClockV1 }): Promise<CalcTableResultV1>;
  /** Every function the engine knows. */
  functions(): Promise<CalcFunctionV1[]>;
}
