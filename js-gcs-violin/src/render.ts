// @ts-ignore
import * as d3 from "d3";
import { FontInfo, Size, Tooltip, MarkingOperation, DataViewRow, ModProperty} from "spotfire-api";
import { RenderState } from "./index";
// @ts-ignore
import lasso from './lasso';

type D3_SELECTION = d3.Selection<SVGGElement, unknown, HTMLElement, any>;

/**
 * Main svg container
 */
const svg = d3.select("#mod-container").append("svg").attr("xmlns", "http://www.w3.org/2000/svg");
var shiftPressed = false;
window.onkeyup = function(e:any) { if(e.keyCode == 16) shiftPressed = false;}
window.onkeydown = function(e:any) { if(e.keyCode == 16) shiftPressed = true; }
export interface Options {
    /** Violin types include normal, history, and with data points */
    violintype: string;
    /** To do: If true the x labels will be rotated in order to align with the axis */
    flipAxis: boolean;
    /** To do: would color the violing area instead of individual points*/
    colorforViolin: boolean;
    /** Places a box plot on top of violin*/
    includeBoxplot: boolean;
    //**resolution for violin */
    resolution?: ModProperty<number>;
    onLabelClick(x: number, y: number): void;
}

const defaultConfig: Options = {
    
    violintype: "basic",
    flipAxis: false,
    colorforViolin: false,
    includeBoxplot: false,
    onLabelClick: () => {}
};

export interface RowData {
    X: string;
    Y: number;
    Color: string;
    Marked: boolean;
    id: string;
    mark(mode?: MarkingOperation): void;
    row:DataViewRow;
}

export interface Data {
    yDomain: { min: number; max: number };
    xScale: string[];
    clearMarking(): void;
    dataPoints: RowData[];
    categories: string[]
    mark(rows: DataViewRow[], mode?: MarkingOperation): void;
}

/**
 * Renders the chart.
 * @param {RenderState} state
 * @param {Spotfire.DataView} dataView - dataView
 * @param {Spotfire.Size} windowSize - windowSize
 * @param {Partial<Options>} config - config
 * @param {Object} styling - styling
 * @param {Tooltip} tooltip - tooltip
 * @param {any} popoutClosedEventEmitter - popoutClosedEventEmitter
 */
export async function render(
    state: RenderState,
    data: Data,
    windowSize: Size,
    config: Partial<Options>,
    styling: {
        scales: FontInfo;
        stroke: string;
    },
    tooltip: Tooltip,
    popoutClosedEventEmitter: any
) {
    if (state.preventRender) {
        // Early return if the state currently disallows rendering.
        return;
    }

    //Slider logic to control resolution. For time being this has been hidden from user
    var slider = document.getElementById("myRange");
    var output = document.getElementById("demo");
    
  

    slider.oninput = function(this:any) {
        output.innerHTML = this.value;
      }

    const onSelection = (dragSelectActive: boolean) => {
        state.preventRender = dragSelectActive;
    };

    /**
     * The constant that contains all the options related to the way the chart is drawn
     */
    const cfg: Options = {
        ...defaultConfig,
        ...config
    };

    let popoutClosed = false;

    let rowsToBeMarked: DataViewRow[] = Array();

    popoutClosedEventEmitter.on("popoutClosed", onPopoutClosed);

    const yDomain = [data.yDomain.min, data.yDomain.max];

    /**
     * Calculating the position and size of the chart
     */
    

    const margin = {top: 20, right: 30, bottom: 80, left: 80},
    width = windowSize.width - margin.left - margin.right,
    height = windowSize.height - margin.top - margin.bottom;
    //console.log(width);
    //console.log(height);
    //console.log(windowSize);
    /**Radius of individual data point circles */
    const radius = height * .007;

    svg.selectAll("*").remove();
    
    /**
     * Set the width and height of svg and translate it
     */
   // svg.attr("viewBox", `0, 0, ${diameter}, ${diameter}`);
    svg.style("width", width + margin.left + margin.right);
    svg.style("height",height + margin.top + margin.bottom);
    var g = svg.append("g")
         .attr("transform",
             "translate(" + margin.left + "," + margin.top + ")");


    


    /**
     * Draw y axis
     */
    var y = d3.scaleLinear()
    .domain([ data.yDomain.min-(data.yDomain.max-data.yDomain.min) * .2,data.yDomain.max + data.yDomain.max * .1]) //y domain using our min and max values calculated earlier
    .range([height, 0])
    
    g.append("g")
    .attr("class", "axis")
    .attr("font-family", styling.scales.fontFamily)
    .attr("fill", styling.scales.color)
    .attr("font-weight",styling.scales.fontWeight)
    .style("font-size", styling.scales.fontSize)
    .call( d3.axisLeft(y) )


    /**
     * Draw x axis
     */
    var x = d3.scaleBand()
        .range([ 0, width ])
        .domain(data.categories) //earlier we extracted the unique categories into an array
        .padding(0.02)     // This is important: it is the space between 2 groups. 0 means no padding. 1 is the maximum.
    g.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + height + ")")
        .attr("font-family", styling.scales.fontFamily)
        .attr("fill", styling.scales.color)
        .attr("font-weight",styling.scales.fontWeight)
        .style("font-size", styling.scales.fontSize)
        .call(d3.axisBottom(x));

    /**
     * Starts the kernel Density Estimator. We estimate the resolution by using the max y value
     */
     var kde = kernelDensityEstimator(kernelEpanechnikov((data.yDomain.max * .2)/8), y.ticks(40))

    /**
     * Grouping data by the categories and calculating metrics for box plot
     */
    let sumstat = d3.nest()  // nest function allows to group the calculation per level of a factor
    .key(function(d:any) { return d.X;})
    .rollup(function(d:any)   {   
        var input:number[] = d.map(function(g:any) { return g.Y as any;});   
        var density:(number)[][] = kde(input)! as number[][] ;
        //calculate different metrics 
        var q1:number = d3.quantile(d.map(function(g:any) { return g.Y as any;}).sort(d3.ascending),.25)! || 0
        var median:number = d3.quantile(d.map(function(g:any) { return g.Y as any;}).sort(d3.ascending),.5)! || 0
        var q3: number = d3.quantile(d.map(function(g:any) { return g.Y as any;}).sort(d3.ascending),.75)! || 0
        var interQuantileRange:number= q3! - q1!
        var min:number = q1! - 1.5 * interQuantileRange
        var max:number = q3! + 1.5 * interQuantileRange
            
        return({"density":density, "q1":q1, "median": median, "q3": q3, "interQuantileRange":interQuantileRange, "min": min, "max":max}) as any
        })
    .entries(data.dataPoints)

    /**
     * Get biggest number in a bin
     */
     var maxNum:number = 0
     console.log(sumstat);
     for ( let i in sumstat ){
         
         if(sumstat[i].value)
         {
            var allBins = sumstat[i].value.density;
            var kdeValues:number[]  = allBins.map(function(a:any){return a[1];})
            var biggest:number  = d3.max(kdeValues)! || 0
            if (biggest  > maxNum) { maxNum = biggest  }
         }
     }

    /**
     * Xnum is used for the correct placing of violin area
     */
     var xNum = d3.scaleLinear()
     .range([0, x.bandwidth()])
     .domain([-maxNum,maxNum])

    /**
     * Add the violing to the svg
     */
     g
     .selectAll("violin")
     .data(sumstat)
     .enter()        // So now we are working group per group
     .append("g")
     .attr("transform", function(d:any){ 
         return("translate(" + x(d.key) +" ,0)") } ) // Translation on the right to be at the group position
     .style("stroke", "none")
         .style("fill",function(d:any){ 
             //console.log(d)
             return("#7289f9"/*ColorsDict[d.key]*/)})
     .append("path")
         .datum(function(d:any){ return(d.value.density)})     // So now we are working bin per bin
         
         .attr("d", d3.area()
             .x0( function(d : any){ return( config.violintype == "jitter" ? xNum(0) : xNum(-d[1])) as number }  )
             .x1(function(d: any){ return(xNum(d[1])) as number } )
             .y(function(d: any){ return(y(d[0])) as number } )
             .curve(config.violintype == "history" ? d3.curveStep :d3.curveCatmullRom)    // This makes the line smoother to give the violin appearance. Try d3.curveStep to see the difference
         );
    

    

    /**
     * Add box plot if option is selected
     */
    
    
    const boxWidth =  x.bandwidth()/8;
    
    if(config.includeBoxplot)
    {
        var boxplot =  g
        .selectAll("boxplot")
        .data(sumstat)
        .enter()        // So now we are working group per group
        .append("g")
        .attr("transform", function(d:any){ 
            return("translate(" + x(d.key) +" ,0)") } )
            .on('mouseover', function (d:any) {
                tooltip.show(
                    "Min: " + d.value.min.toFixed(2) + "\n" +
                    "Max: " + d.value.max.toFixed(2) + "\n" +
                    "Q1: " + d.value.q1.toFixed(2) + "\n" +
                    "Q3: " + d.value.q3.toFixed(2) + "\n" +
                    "Median: " + d.value.median.toFixed(2) + "\n" 

                );    
            })   
            .on('mouseout', function (d:any, i:any) {
            
                tooltip.hide();
            });

            boxplot.append("line")
        .attr("x1",  x.bandwidth()/2 )
        .attr("x2",  x.bandwidth()/2 )
        .attr("y1", function(d:any){  return y(d.value.min) as any;} )
        .attr("y2", function(d:any){  return y(d.value.max) as any;} )
        .attr("stroke", "#FAA264")
        .style("stroke-width", 5)
        
        boxplot.append("rect")
        .attr("x", x.bandwidth()/2 - (config.violintype == "jitter" ? 0 : boxWidth/2))
        .attr("y", function(d:any){  return y(d.value.q3) as any;} )
        .attr("height", function(d:any){  return (y(d.value.q1) - y(d.value.q3)) as any;}  )
        .attr("width", (config.violintype == "jitter" ? boxWidth/2 :boxWidth) )
        
        .style("fill", "#FAA264")
        
        
        boxplot.append("line")
        .attr("x1", x.bandwidth()/2 - (config.violintype == "jitter" ? 0 : boxWidth/2))
        .attr("x2", x.bandwidth()/2 + boxWidth/2)
        .attr("y1", function(d:any){ return(y(d.value.min)) as any} )
        .attr("y2", function(d:any){ return(y(d.value.min)) as any } )
        .attr("stroke", "#FAA264")
        .style("stroke-width", 5)

        boxplot.append("line")
        .attr("x1", x.bandwidth()/2 -(config.violintype == "jitter" ? 0 : boxWidth/2))
        .attr("x2", x.bandwidth()/2 + boxWidth/2)
        .attr("y1", function(d:any){ return(y(d.value.median)) as any} )
        .attr("y2", function(d:any){ return(y(d.value.median)) as any } )
        .attr("stroke", "white")
        .style("stroke-width", 5)

        boxplot.append("line")
        .attr("x1", x.bandwidth()/2 - (config.violintype == "jitter" ? 0 : boxWidth/2))
        .attr("x2", x.bandwidth()/2 + boxWidth/2)
        .attr("y1", function(d:any){ return(y(d.value.max)) as any} )
        .attr("y2", function(d:any){ return(y(d.value.max)) as any } )
        .attr("stroke", "#FAA264")
        .style("stroke-width", 5)

     }

    /**Here we are grouping data by first category and then by Y value so the circles can be placed appropiately  */
    var pointsByCat = d3.nest()
     .key(function(d:any) { return d.X;})
     .rollup(function(d:any) {   // For each key..
        var yvals = d.map(function(g:any) { return ({"Y": g.Y, "Color": g.Color, "row": g.row})})   
        var groupedYvals = d3.nest()
                        .key(function(f:any) {return f.Y})
                        .rollup(function(f:any) {
                            return (f.map(function(h:any){return ({"Y": h.Y, "Color": h.Color, "row": h.row}) as any}));
                        })
                        .entries(yvals);
            
        return(groupedYvals) as any})
         .entries(data.dataPoints)
    
         
         pointsByCat.forEach(function(entry:any)
         {
             entry.value = entry.value.slice().sort((a:any, b:any) => d3.ascending(a.Y, b.Y))
         } );

    if(config.violintype == "jitter")
    {
        
        g
        .selectAll("indPoints")
        .data(pointsByCat)
        .enter()
        .append("g")
        .attr("transform", function(d:any){ 
        return("translate(" + x(d.key) +" ,0)") } )
        .selectAll("circlegroups") 
        .data(function(d:any){return d.value as any;})
        .enter()
        .append("g")
        .selectAll("circle") 
        .data(function(d:any){return d.value;})
        .enter()
            .append("circle")
            .attr("cx", function(d:any,j:any){return(  x.bandwidth()/2 - ((radius * 2) * (j+1))  )})
            .attr("cy", function(d:any){
                return(y(d.Y)) as any})
            .attr("r",radius)
            .style("fill", function(d:any ){  return(d.Color) as any})
            .attr("stroke", "white")
            .on('mouseover', function (d:any) {
                tooltip.show(d.Y);    
            })   
            .on('mouseout', function (d:any, i:any) {
                
                tooltip.hide();
            })
            .on('change', function (d:any) {
                rowsToBeMarked.push(d.row);
                console.log("added");
            });
    }


    //**Function that will tell spotfire what to mark after lasso has been drawn */
    var lasso_end = function() {
    
    mainLasso.selectedItems().dispatch("change");
    data.mark(rowsToBeMarked, (shiftPressed) ? "Add" : "Replace");
    
    };

    //**Initializes Lasso */
    var mainLasso = lasso();
    mainLasso.closePathSelect(true)
    mainLasso.closePathDistance(100)
    mainLasso.items(d3.selectAll("circle"))
    mainLasso.targetArea(svg)
    mainLasso.on("end",lasso_end);

    //console.log(lasso()(svg));
    mainLasso(svg);
         
     
    // svg.call(mainLasso(svg));
    drawRectangularSelection();//TO DO

    d3.selectAll("#dropdownMenuButton1").on("click", function () {
        const mouse = d3.mouse(document.body);
        cfg.onLabelClick(mouse[0], mouse[1]);
    });

    d3.selectAll("#myRange").on("change", function (d:any) {
        config.resolution?.set(parseFloat((<HTMLInputElement>document.getElementById("myRange")).value));
    });

    

    

    /**
     * Draws rectangular selection
     */
    function drawRectangularSelection() {
        
    }

    function onPopoutClosed() {
        popoutClosed = true;
    }
}

/*function mark(d: Serie | Point) {
    d3.event.ctrlKey ? d.mark("ToggleOrAdd") : d.mark();
}*/

function kernelDensityEstimator(kernel:Function, X:number[]) {
    return function(V:number[]) {
      return X.map(function(x) {
        return [x, d3.mean(V, function(v:any) { return kernel(x - v); })];
      });
    };
  }
  function kernelEpanechnikov(k:number) {
    return function(v:number) {
      return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
    };
  }


