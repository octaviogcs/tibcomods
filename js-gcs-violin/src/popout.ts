import { Controls, ModProperty } from "spotfire-api";

export function createLabelPopout(
    controls: Controls,
    violintype: ModProperty<string>,
    //flipAxis: ModProperty<boolean>,
    //colorforViolin: ModProperty<boolean>,
    includeBoxplot: ModProperty<boolean>,
    popoutClosedEventEmitter: any
) {
    const { radioButton, checkbox } = controls.popout.components;
    const { section } = controls.popout;

    /**
     * Popout content
     */
    const is = (property: ModProperty) => (value: any) => property.value() == value;

    const popoutContent = () => [
        section({
            heading: "Violin Type",
            children: [
                radioButton({
                    name: violintype.name,
                    text: "Normal",
                    value: "basic",
                    checked: is(violintype)("basic")
                }),
                radioButton({
                    name: violintype.name,
                    text: "History",
                    value: "history",
                    checked: is(violintype)("history")
                }),
                radioButton({
                    name: violintype.name,
                    text: "With Data Points",
                    value: "jitter",
                    checked: is(violintype)("jitter")
                })
            ]
        }),
        /*section({
            children: [
                checkbox({
                    name: flipAxis.name,
                    text: "Flip axis",
                    checked: is(flipAxis)(true),
                    enabled: true
                })
            ]
        }),
        section({
            children: [
                checkbox({
                    name: colorforViolin.name,
                    text: "Apply color to violin area",
                    checked: is(colorforViolin)(true),
                    enabled: true
                })
            ]
        }),*/
        section({
            children: [
                checkbox({
                    name: includeBoxplot.name,
                    text: "Include Box Plot",
                    checked: is(includeBoxplot)(true),
                    enabled: true
                })
            ]
        })
    ];

    return function show(x: number, y: number) {
        controls.popout.show(
            {
                x: x,
                y: y,
                autoClose: true,
                alignment: "Top",
                onChange: (event) => {
                    const { name, value } = event;
                    name == violintype.name && violintype.set(value);
                    //name == flipAxis.name && flipAxis.set(value);
                    //name == colorforViolin.name && colorforViolin.set(value);
                    name == includeBoxplot.name && includeBoxplot.set(value);
                },
                onClosed: () => {
                    popoutClosedEventEmitter.emit("popoutClosed");
                }
            },
            popoutContent
        );
    };
}
