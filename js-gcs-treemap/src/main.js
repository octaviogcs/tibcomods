// Get access to the Spotfire Mod API by providing a callback to the initialize method.
Spotfire.initialize(async (mod) => {

    const reader = mod.createReader(
        mod.visualization.data(),
        mod.windowSize()
    );

    // This Mod does not rely on data outside the
    // mod itself so no read errors are expected.
     reader.subscribe(render);
    /**
     *
     * @param {Spotfire.DataView} dataView
     * @param {Spotfire.Size} size
     */

    async function render(dataView, size) {
        const dataHierarchy = await dataView.hierarchy("Hierarchy");

        const root = await dataHierarchy.root();
        const levels = await dataHierarchy.levels;

        var treeData = [
            {
                //levels[0].name is the top level hierarchical axis name
                //changed 'name' in treediag.js to 'key' to simplify mapping.
              "key": levels[0].name,
              "parent": "null",
              "children": root.children
            }
          ];

        treediag(size, treeData);

        return;
   
    }

});

/** @returns {HTMLElement} */
function findElem(selector) {
    return document.querySelector(selector);
}

