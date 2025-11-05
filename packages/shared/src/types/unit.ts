import { Unit } from "../schemas/public/Unit";
import { Static, t } from "elysia";
import { PartVariation } from "./part-variation";

export type { Unit };

export type UnitWithPartVariation = Unit & {
  partVariation: PartVariation;
};

export type UnitWithParent = Unit & {
  parent: UnitWithPartVariation | null;
};

export const insertUnit = t.Object({
  projectId: t.Optional(t.String()),
  partVariationId: t.String(),
  serialNumber: t.String({ minLength: 1 }),
  components: t.Array(t.String(), { default: [] }),
});

export type InsertUnit = Static<typeof insertUnit>;

export const produceUnits = t.Object({
  projectId: t.Optional(t.String()),
  partVariationId: t.String(),
  code: t.String({ pattern: "^[A-Za-z]{2}$" }),
  count: t.Number({ minimum: 1, maximum: 500 }),
});

export type ProduceUnits = Static<typeof produceUnits>;

export const produceUnitsPreviewQuery = t.Object({
  partVariationId: t.String(),
  code: t.String({ pattern: "^[A-Za-z]{2}$" }),
});

export type ProduceUnitsPreviewQuery = Static<typeof produceUnitsPreviewQuery>;

export const produceUnitsPreviewResponse = t.Object({
  prefix: t.String(),
  next: t.String(), // 6-digit string
  sample: t.String(), // full serial example with next
});

export type ProduceUnitsPreviewResponse = Static<
  typeof produceUnitsPreviewResponse
>;

export type UnitTreeRoot = UnitWithPartVariation &
  UnitWithParent & {
    components: UnitTreeNode[];
  };

export type UnitTreeNode = Pick<
  Unit,
  "serialNumber" | "id" | "partVariationId"
> & {
  partNumber: string;
  components: UnitTreeNode[];
};

export const swapUnitComponent = t.Object({
  unitId: t.String(),
  oldUnitComponentId: t.String(),
  newUnitComponentId: t.String(),
  reason: t.Optional(t.String()),
});

export type SwapUnitComponent = Static<typeof swapUnitComponent>;

export const unitRevisionType = t.Union([
  t.Literal("init"),
  t.Literal("remove"),
  t.Literal("add"),
]);

export const unitRevision = t.Object({
  unitId: t.String(),
  revisionType: unitRevisionType,
  createdAt: t.Date(),
  componentId: t.String(),
  componentSerialNumber: t.String(),
  reason: t.Nullable(t.String()),
  userId: t.String(),
  userEmail: t.String(),
});

export type UnitRevision = Static<typeof unitRevision>;
export type RevisionType = Static<typeof unitRevisionType>;
