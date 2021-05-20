# D3 Treemap Implementation
This is a mod derived from the mod template project. 

All source code for the mod example can be found in the `src` folder.

## Prerequisites
These instructions assume that you have [Node.js](https://nodejs.org/en/) (which includes npm) installed.

## How to get started (with development server)
- Open a terminal at the location of this example.
- Run `npm install`. This will install necessary tools. Run this command only the first time you are building the mod and skip this step for any subsequent builds.
- Run `npm run server`. This will start a development server.
- Start editing, for example `src/main.js`.
- In Spotfire, follow the steps of creating a new mod and connecting to the development server.

## Working without a development server
- In Spotfire, follow the steps of creating a new mod and then browse for, and point to, the _manifest_ in the `src` folder.


## About the Mod and Data

There are many forms of a hierarchical data and the requirements are similar for each. How can I quickly view my structure and flow of the hierarchy.

In the example provided, the dataset contains a stucture of hierarchical data in the Hogwarts School of Magic. It contains data regarding the houses, genders, designations and names.

Using this data, you can quickly navigate and view the structures. Filter or mark interested data and expand and collapse parent and child nodes.

## Visualization Concepts
A data hierarchy can created by adding columns, as required, to the hierarchy axes or by adding an already existent hierachy that is created natively in Spotfire.

The visualization will generate all the links based on the relationships within the data.

## Interaction with DXP
MOD - Treemap
Open the filter panel and work with the filters to hone in on structures and flows.  
The Visualization is responsive to filters and markings.