// SPDX-License-Identifier: MPL-2.0
/** Design layout capability, added in engine 1.249. Rules use the Design blocks adapter. */
export interface LayoutAPI {
  evaluate(request: {
    boxes: Array<Record<string, unknown>>;
    tracks?: Array<Record<string, unknown>>;
  }): Promise<{
    boxes: Array<Record<string, unknown>>;
    findings: Array<{ id: string; code: string; message: string }>;
    passes: number;
    solved: number;
    grids: Array<{
      id: string;
      columns: number[][];
      rows: number[][];
      cells?: Array<{
        id: string;
        row: number;
        column: number;
        rowSpan: number;
        columnSpan: number;
      }>;
    }>;
  }>;
}
