import { Data, Options, render, RowData } from "./render";
import { createLabelPopout } from "./popout";
import { AxisPart, DataView, DataViewHierarchyNode, DataViewRow, Mod, ModProperty } from "spotfire-api";
var events = require("events");

const Spotfire = window.Spotfire;
const DEBUG = true;

export interface RenderState {
    preventRender: boolean;
}

Spotfire.initialize(async (mod) => {
    const context = mod.getRenderContext();

    /**
     * Create reader function which is actually a one time listener for the provided values.
     */
    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize(),
        mod.property<string>("violintype"),
        mod.property<boolean>("flipAxis"),
        mod.property<boolean>("colorforViolin"),
        mod.property<boolean>("includeBoxplot"),
        mod.property<boolean>("resolution")
    );

    /**
     * Create a persistent state used by the rendering code
     */
    const state: RenderState = { preventRender: false };

    /**
     * Creates a function that is part of the main read-render loop.
     * It checks for valid data and will print errors in case of bad data or bad renders.
     * It calls the listener (reader) created earlier and adds itself as a callback to complete the loop.
     */
    reader.subscribe(generalErrorHandler(mod)(onChange));

    /**
     * The function that is part of the main read-render loop.
     * It checks for valid data and will print errors in case of bad data or bad renders.
     * It calls the listener (reader) created earlier and adds itself as a callback to complete the loop.
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.Size} windowSize
     * @param {ModProperty<string>} violintype
     * @param {ModProperty<boolean>} flipAxis
     * @param {ModProperty<boolean>} colorforViolin
     * @param {ModProperty<boolean>} includeBoxplot
     * @param {ModProperty<double>} resolution
     */
    async function onChange(
        dataView: DataView,
        windowSize: Spotfire.Size,
        violintype: ModProperty<string>,
        flipAxis: ModProperty<boolean>,
        colorforViolin: ModProperty<boolean>,
        includeBoxplot: ModProperty<boolean>,
        resolution: ModProperty<number>
    ) {
        let data = await buildData(mod, dataView);

        var popoutClosedEventEmitter = new events.EventEmitter();

        const config: Partial<Options> = {
            violintype: violintype.value()!,
            flipAxis: flipAxis.value()!,
            colorforViolin: colorforViolin.value()!,
            includeBoxplot: includeBoxplot.value()!,
            onLabelClick: createLabelPopout(
                mod.controls,
                violintype,
                //flipAxis,
                //colorforViolin,
                includeBoxplot,
                popoutClosedEventEmitter
            ),
            resolution: resolution
            
        };

        await render(
            state,
            data,
            windowSize,
            config,
            {
                scales: context.styling.scales.font,
                stroke: context.styling.scales.line.stroke
            },
            mod.controls.tooltip,
            popoutClosedEventEmitter
        );

        context.signalRenderComplete();
    }
});

/**
 * subscribe callback wrapper with general error handling, row count check and an early return when the data has become invalid while fetching it.
 *
 * The only requirement is that the dataview is the first argument.
 * @param mod - The mod API, used to show error messages.
 * @param rowLimit - Optional row limit.
 */
export function generalErrorHandler<T extends (dataView: Spotfire.DataView, ...args: any) => any>(
    mod: Spotfire.Mod,
    rowLimit = 40000
): (a: T) => T {
    return function (callback: T) {
        return async function callbackWrapper(dataView: Spotfire.DataView, ...args: any) {
            try {
                const errors = await dataView.getErrors();
                if (errors.length > 0) {
                    mod.controls.errorOverlay.show(errors, "DataView");
                    return;
                }
                mod.controls.errorOverlay.hide("DataView");

                /**
                 * Hard abort if row count exceeds an arbitrary selected limit
                 */
                const rowCount = await dataView.rowCount();
                if (rowCount && rowCount > rowLimit) {
                    mod.controls.errorOverlay.show(
                        `☹️ Cannot render - too many rows (rowCount: ${rowCount}, limit: ${rowLimit}) `,
                        "General"
                    );
                    return;
                }

                /**
                 * User interaction while rows were fetched. Return early and respond to next subscribe callback.
                 */
                const allRows = await dataView.allRows();
                if (allRows == null) {
                    return;
                }

                await callback(dataView, ...args);

                mod.controls.errorOverlay.hide("General");
            } catch (e) {
                mod.controls.errorOverlay.show(
                    e.message || e || "☹️ Something went wrong, check developer console",
                    "General"
                );
                if (DEBUG) {
                    throw e;
                }
            }
        } as T;
    };
}

/**
 * Construct a data format suitable for consumption in d3.
 * @param mod The Mod API object
 * @param dataView The mod's DataView
 */
async function buildData(mod: Mod, dataView: DataView): Promise<Data> {
    const allRows = await dataView.allRows();
    let categories: Array<string> = new Array();
    let values : Array<number> = new Array();
    let data : Array<RowData> = new Array();
    
    allRows!.forEach(row => {
        //  console.log(row);
        
        var cat = row.categorical("X").formattedValue();
        if(!categories.includes(cat))
            categories.push(cat);
        var val = row!.continuous<number>("Y").value() || 0;
        values.push(val);
        
        data.push({"X": cat, "Y": val, "Color": row.color().hexCode, "Marked": row.isMarked(), "id": row.elementId(true), "mark": (m) => row.mark(m), "row": row});
        
  
      });

    
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);

    const xHierarchy = await dataView.hierarchy("X");
   
    const xHierarchyLeaves = (await xHierarchy!.root())!.leaves();

    const xAxisData = xHierarchyLeaves.map((leaf) => leaf.formattedPath());


    return {
        clearMarking: dataView.clearMarking,
        yDomain: { min: minValue, max: maxValue },
        xScale: xAxisData,
        dataPoints: data,
        categories: categories,
        mark: (m,n) => dataView.mark(m,n)
    };

   

    function getFormattedValues(node: DataViewHierarchyNode) {
        let values: string[] = [];
        while (node.parent) {
            values.push(node.formattedValue());
            node = node.parent;
        }

        return values.reverse();
    }

    function createAxisTooltip(axisParts: AxisPart[], formattedValues: string[], separator: string) {
        return axisParts.length == formattedValues.length
            ? formattedValues.map((v, i) => axisParts[i].displayName + ": " + v).join(separator)
            : null;
    }
}
