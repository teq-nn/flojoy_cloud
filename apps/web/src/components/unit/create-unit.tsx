import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useForm } from "react-hook-form";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";
import { client } from "@/lib/client";
import {
  getPartVariationQueryOpts,
  getPartVariationsQueryOpts,
} from "@/lib/queries/part-variation";
import {
  getPartVariationUnitQueryKey,
  getUnitsQueryKey,
  getUnitsQueryOpts,
} from "@/lib/queries/unit";
import { handleError } from "@/lib/utils";
import { PartVariationTreeRoot, Workspace, insertUnit } from "@cloud/shared";
import { typeboxResolver } from "@hookform/resolvers/typebox";
import { Static, Type as t } from "@sinclair/typebox";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  useQuery,
} from "@tanstack/react-query";
import { Icons } from "../icons";
import { Combobox } from "../ui/combobox";

const formSchema = t.Composite([
  t.Omit(insertUnit, ["components"]),
  t.Object({
    components: t.Array(t.Object({ unitId: t.String() })),
  }),
]);

type FormSchema = Static<typeof formSchema>;

type Props = {
  workspace: Workspace;
  partVariationId: string;
  projectId?: string;
  children?: React.ReactNode;
};

const getComponentPartVariationIds = (tree: PartVariationTreeRoot) => {
  // TODO: Only get depth 1
  return tree.components.flatMap((m) =>
    new Array<string>(m.count).fill(m.partVariation.id),
  );
};

const CreateUnit = ({
  children,
  workspace,
  partVariationId,
  projectId,
}: Props) => {
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
  const [isBatch, setIsBatch] = useState<boolean>(false);
  const [batchCode, setBatchCode] = useState<string>("");
  const [batchCount, setBatchCount] = useState<number>(1);
  const [devicePartVariations, setDevicePartVariations] = useState<
    string[] | undefined
  >(undefined);
  const queryClient = useQueryClient();

  const createUnit = useMutation({
    mutationFn: async (values: Static<typeof insertUnit>) => {
      const { error } = await client.unit.index.post(values, {
        headers: { "flojoy-workspace-id": workspace.id },
      });
      if (error) throw error.value;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getUnitsQueryKey() });
      queryClient.invalidateQueries({
        queryKey: getPartVariationUnitQueryKey(partVariationId),
      });
      setIsDialogOpen(false);
    },
  });

  const { data: units } = useSuspenseQuery(
    getUnitsQueryOpts({ onlyAvailable: true, context: { workspace } }),
  );
  const { data: partVariations } = useSuspenseQuery(
    getPartVariationsQueryOpts({ context: { workspace } }),
  );
  const { data: partVariationTree, isPending: treeLoading } = useSuspenseQuery(
    getPartVariationQueryOpts({ context: { workspace }, partVariationId }),
  );

  const currentPartNumberRaw =
    partVariations.find((m) => m.id === partVariationId)?.partNumber ?? "PART";
  const currentPartNumber = currentPartNumberRaw.trim().replace(/\s+/g, "-");
  const codeForPreview = (batchCode || "AA").toUpperCase().slice(0, 2);
  const { data: preview } = useQuery({
    queryKey: [
      "produce-preview",
      workspace.id,
      partVariationId,
      codeForPreview,
    ],
    queryFn: async () => {
      const res = await client.unit.produce.preview.get({
        query: { partVariationId, code: codeForPreview },
        headers: { "flojoy-workspace-id": workspace.id },
      });
      if ((res as any).error) throw (res as any).error.value;
      return (res as any).data as {
        prefix: string;
        next: string;
        sample: string;
      };
    },
    enabled: isBatch && codeForPreview.length === 2,
  });
  const previewSerial = preview?.sample ?? `${currentPartNumber}-${codeForPreview}-NNNNNN`;

  const form = useForm<FormSchema>({
    resolver: typeboxResolver(formSchema),
    defaultValues: {
      partVariationId,
      projectId,
      components: [],
    },
  });

  // Keep serialNumber non-empty when batch mode is on so client-side validation passes
  useEffect(() => {
    if (isBatch) {
      form.clearErrors("serialNumber");
      form.setValue("serialNumber", previewSerial);
    } else {
      form.setValue("serialNumber", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBatch, previewSerial]);

  useEffect(() => {
    const devicePartVariations =
      getComponentPartVariationIds(partVariationTree);

    form.setValue("partVariationId", partVariationId);
    form.setValue(
      "components",
      devicePartVariations.map(() => ({
        unitId: "",
      })),
    );
    setDevicePartVariations(devicePartVariations);
  }, [partVariationId, form, partVariationTree]);

  if (!units) {
    return (
      <Button variant="default" size="sm" disabled={true}>
        {children}
      </Button>
    );
  }

  function onSubmit(values: FormSchema) {
    if (isBatch) {
      const code = (batchCode || "").toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) {
        toast.error("Code must be two letters (A-Z)");
        return;
      }
      const count = Number(batchCount) || 0;
      if (count < 1 || count > 500) {
        toast.error("Quantity must be between 1 and 500");
        return;
      }
      toast.promise(
        (async () => {
          const { data, error } = await client.unit.produce.post(
            {
              code,
              count,
              partVariationId,
              projectId,
            },
            { headers: { "flojoy-workspace-id": workspace.id } },
          );
          if (error) throw error;
          return data as any;
        })(),
        {
          loading: "Producing units...",
          success: (data) => {
            const serials = (data as any)?.serials as string[] | undefined;
            queryClient.invalidateQueries({ queryKey: getUnitsQueryKey() });
            queryClient.invalidateQueries({
              queryKey: getPartVariationUnitQueryKey(partVariationId),
            });
            setIsDialogOpen(false);
            if (serials && serials.length > 0) {
              return `Created ${serials.length} units (${serials[0]} .. ${serials[serials.length - 1]})`;
            }
            return "Units created";
          },
          error: handleError,
        },
      );
      return;
    }
    // Ensure serialNumber provided for single registration
    if (!values.serialNumber || values.serialNumber.trim().length === 0) {
      form.setError("serialNumber", { message: "Serial number is required" });
      return;
    }
    const devicePartVariations =
      getComponentPartVariationIds(partVariationTree);
    if (devicePartVariations.length > 0) {
      let hasError = false;
      for (let i = 0; i < values.components.length; i++) {
        if (values.components[i]?.unitId === "") {
          form.setError(`components.${i}.unitId` as const, {
            message: "Cannot have empty component",
          });
          hasError = true;
        }
      }
      if (hasError) {
        return;
      }
    }
    toast.promise(
      createUnit.mutateAsync({
        ...values,
        components: values.components.map((c) => c.unitId),
      }),
      {
        loading: "Creating your unit instance...",
        success: "Your unit is ready.",
        error: handleError,
      },
    );
  }

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          form.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register new unit</DialogTitle>
          <DialogDescription>
            Which unit of yours do you want to register?
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="batch-toggle"
                type="checkbox"
                className="h-4 w-4"
                checked={isBatch}
                onChange={(e) => setIsBatch(e.target.checked)}
              />
              <FormLabel htmlFor="batch-toggle">Produce batch</FormLabel>
            </div>

            {isBatch ? (
              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>Code (2 letters)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. AB"
                      value={batchCode}
                      onChange={(e) =>
                        setBatchCode(e.target.value.toUpperCase().slice(0, 2))
                      }
                      maxLength={2}
                    />
                  </FormControl>
                  <FormDescription>Used in serials (e.g. FP-AB-000123)</FormDescription>
                </FormItem>
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>Number of units to produce</FormDescription>
                </FormItem>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isBatch ? "Serial Number (auto-generated)" : "Serial Number"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={isBatch ? previewSerial : "e.g. SN4321"}
                      {...field}
                      disabled={isBatch}
                      data-1p-ignore
                    />
                  </FormControl>
                  <FormDescription>
                    {isBatch
                      ? `Will be generated as ${previewSerial} (6 digits) for ${batchCount} unit(s).`
                      : "A unique identifier for this unit instance."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {treeLoading ? (
              <Icons.spinner className="mx-auto animate-spin" />
            ) : (
              !isBatch &&
              devicePartVariations !== undefined &&
              devicePartVariations.length > 0 && (
                <div>
                  <FormLabel>Parts</FormLabel>
                  <FormDescription>
                    What are the device instances that make up this system?
                  </FormDescription>
                  <div>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex w-fit flex-col gap-y-6">
                        {devicePartVariations.sort().map((part, index) => (
                          <Badge key={index}>
                            {
                              partVariations.find((m) => m.id === part)
                                ?.partNumber
                            }
                          </Badge>
                        ))}
                      </div>
                      <div className="flex w-fit flex-col gap-y-1.5">
                        {devicePartVariations.sort().map((part, index) => (
                          <FormField
                            control={form.control}
                            key={`${part}-${index}`}
                            name={`components.${index}.unitId` as const}
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-2">
                                <FormControl>
                                  <Combobox
                                    options={units.filter(
                                      (hw) => hw.partVariationId === part,
                                    )}
                                    value={field.value}
                                    setValue={(val) =>
                                      form.setValue(
                                        `components.${index}.unitId` as const,
                                        val ?? "",
                                      )
                                    }
                                    displaySelector={(val) => val.serialNumber}
                                    valueSelector={(val) => val.id}
                                    searchText="Search unit..."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}

            <DialogFooter className="">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
              <Button type="submit">Register</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateUnit;
