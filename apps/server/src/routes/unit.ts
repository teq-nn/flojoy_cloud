import {
  PartVariation,
  insertUnit,
  queryBool,
  swapUnitComponent,
  produceUnits,
  produceUnitsPreviewQuery,
} from "@cloud/shared";
import { Elysia, error, t } from "elysia";
import { db } from "../db/kysely";
import {
  createUnit,
  createUnitTx,
  doUnitComponentSwap,
  getUnit,
  getUnitRevisions,
  getUnitTree,
  notInUse,
  withUnitParent,
  withUnitPartVariation,
} from "../db/unit";
import { checkUnitPerm } from "../lib/perm/unit";
import { checkWorkspacePerm } from "../lib/perm/workspace";
import { WorkspaceMiddleware } from "../middlewares/workspace";

export const UnitRoute = new Elysia({ prefix: "/unit", name: "UnitRoute" })
  .use(WorkspaceMiddleware)
  .get(
    "/",
    async ({ workspace, query: { onlyAvailable } }) => {
      let query = db
        .selectFrom("unit")
        .selectAll("unit")
        .where("unit.workspaceId", "=", workspace.id)
        .select((eb) => withUnitPartVariation(eb))
        .$narrowType<{ partVariation: PartVariation }>()
        .orderBy("unit.serialNumber", "asc");

      if (onlyAvailable) {
        query = query.where(notInUse);
      }

      const data = await query.execute();
      return data;
    },
    {
      query: t.Object({
        onlyAvailable: queryBool,
      }),
      async beforeHandle({ workspaceUser, error }) {
        const perm = await checkWorkspacePerm({ workspaceUser });

        return perm.match(
          (perm) => (perm.canRead() ? undefined : error("Forbidden")),
          (err) => error(403, err),
        );
      },
    },
  )
  .get(
    "/produce/preview",
    async ({ workspace, query }) => {
      const { partVariationId, code } = query;
      const pv = await db
        .selectFrom("part_variation")
        .selectAll("part_variation")
        .where("id", "=", partVariationId)
        .where("workspaceId", "=", workspace.id)
        .executeTakeFirst();
      if (!pv) return { prefix: "", next: "000001", sample: "" };

      const sanitizedPart = pv.partNumber.trim().replace(/\s+/g, "-");
      const prefix = `${sanitizedPart}-${code.toUpperCase()}-`;
      const existing = await db
        .selectFrom("unit")
        .select(["serialNumber"])
        .where("workspaceId", "=", workspace.id)
        .where("partVariationId", "=", pv.id)
        .where("serialNumber", "like", `${prefix}%`)
        .execute();
      let maxSuffix = 0;
      for (const row of existing) {
        const m = row.serialNumber.slice(prefix.length).match(/^(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n) && n > maxSuffix) maxSuffix = n;
        }
      }
      const next = (maxSuffix + 1).toString().padStart(6, "0");
      return { prefix, next, sample: `${prefix}${next}` };
    },
    {
      query: produceUnitsPreviewQuery,
      async beforeHandle({ workspaceUser, error }) {
        const perm = await checkWorkspacePerm({ workspaceUser });
        return perm.match(
          (perm) => (perm.canRead() ? undefined : error("Forbidden")),
          (err) => error(403, err),
        );
      },
    },
  )
  .post(
    "/produce",
    async ({ body, error, workspace, user }) => {
      // Validate part variation and ensure it has no required components (simple device)
      const pv = await db
        .selectFrom("part_variation")
        .selectAll("part_variation")
        .where("id", "=", body.partVariationId)
        .where("workspaceId", "=", workspace.id)
        .executeTakeFirst();
      if (!pv) return error(404, "PartVariation not found");

      // Check if part variation has required components; if so, block batch produce
      const required = await db
        .selectFrom("part_variation_relation")
        .selectAll()
        .where("parentPartVariationId", "=", pv.id)
        .execute();
      if (required.length > 0) {
        return error(
          400,
          "Batch produce is not supported for composite part variations",
        );
      }

      const code = body.code.toUpperCase();
      const sanitizedPart = pv.partNumber.trim().replace(/\s+/g, "-");
      const prefix = `${sanitizedPart}-${code}-`;

      // Find current max numeric suffix for this prefix in this variation
      const existing = await db
        .selectFrom("unit")
        .select(["serialNumber"])
        .where("workspaceId", "=", workspace.id)
        .where("partVariationId", "=", pv.id)
        .where("serialNumber", "like", `${prefix}%`)
        .execute();

      let maxSuffix = 0;
      for (const row of existing) {
        const m = row.serialNumber.slice(prefix.length).match(/^(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isFinite(n) && n > maxSuffix) maxSuffix = n;
        }
      }

      const createdSerials: string[] = [];
      await db.transaction().execute(async (tx) => {
        for (let i = 1; i <= body.count; i++) {
          const num = (maxSuffix + i).toString().padStart(6, "0");
          const serialNumber = `${prefix}${num}`;
          await createUnitTx(tx, workspace.id, user, {
            partVariationId: pv.id,
            serialNumber,
            projectId: body.projectId,
            components: [],
          });
          createdSerials.push(serialNumber);
        }
      });

      return { serials: createdSerials };
    },
    {
      body: produceUnits,
      async beforeHandle({ workspaceUser, error }) {
        const perm = await checkWorkspacePerm({ workspaceUser });
        return perm.match(
          (perm) => (perm.canRead() ? undefined : error("Forbidden")),
          (err) => error(403, err),
        );
      },
    },
  )
  .post(
    "/",
    async ({ body, error, workspace, user }) => {
      const res = await createUnit(db, workspace.id, user, body);
      if (res.isErr()) {
        return error(res.error.code, res.error.message);
      }
      return res.value;
    },
    {
      body: insertUnit,
      async beforeHandle({ workspaceUser, error }) {
        const perm = await checkWorkspacePerm({ workspaceUser });

        return perm.match(
          (perm) => (perm.canRead() ? undefined : error("Forbidden")),
          (err) => error(403, err),
        );
      },
    },
  )
  .group("/:unitId", { params: t.Object({ unitId: t.String() }) }, (app) =>
    app
      .get(
        "/",
        async ({ workspace, params: { unitId }, error }) => {
          const unit = await db
            .selectFrom("unit")
            .selectAll("unit")
            .where("id", "=", unitId)
            .where("workspaceId", "=", workspace.id)
            .select((eb) => [withUnitPartVariation(eb), withUnitParent(eb)])
            .$narrowType<{ partVariation: PartVariation }>()
            .executeTakeFirst();
          if (unit === undefined) {
            return error(404, "Unit not found");
          }

          return await getUnitTree(unit);
        },
        {
          async beforeHandle({ workspaceUser, error, params: { unitId } }) {
            const perm = await checkUnitPerm({ unitId, workspaceUser });

            return perm.match(
              (perm) => (perm.canRead() ? undefined : error("Forbidden")),
              (err) => error(403, err),
            );
          },
        },
      )
      .patch(
        "/",
        async ({ workspaceUser, body, error, params: { unitId } }) => {
          const unit = await getUnit(unitId);
          if (!unit) return error("Not Found");

          const res = await doUnitComponentSwap(unit, workspaceUser, body);
          if (res.isErr()) {
            return error(res.error.code, res.error.message);
          }

          return {
            success: true,
          };
        },
        {
          body: swapUnitComponent,
          async beforeHandle({ workspaceUser, error, params: { unitId } }) {
            const perm = await checkUnitPerm({ unitId, workspaceUser });

            return perm.match(
              (perm) => (perm.canWrite() ? undefined : error("Forbidden")),
              (err) => error(403, err),
            );
          },
        },
      )
      .get(
        "/revisions",
        async ({ params: { unitId } }) => {
          const unit = await getUnit(unitId);
          if (!unit) return error("Not Found");
          return await getUnitRevisions(unit.id);
        },
        {
          async beforeHandle({ workspaceUser, error, params: { unitId } }) {
            const perm = await checkUnitPerm({ unitId, workspaceUser });

            return perm.match(
              (perm) => (perm.canRead() ? undefined : error("Forbidden")),
              (err) => error(403, err),
            );
          },
        },
      ),
  );
