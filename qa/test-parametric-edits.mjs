import assert from 'node:assert/strict';
import {rectangleGeometry} from '../dist/parametric-geometry.js';
import {roundedBox} from '../dist/primitive-geometry.js';
const rectangle={width:100,height:100,depth:10,shape:{points:[[-50,-50],[50,-50],[50,25],[0,50],[-50,25]].map((position,fi)=>({fi,data:{position}}))}};
const original=rectangleGeometry(rectangle),resized=rectangleGeometry({...rectangle,width:150,height:70});original.computeBoundingBox();resized.computeBoundingBox();
for(const [axis,factor]of [['x',1.5],['y',.7]])assert.ok(Math.abs((resized.boundingBox.max[axis]-resized.boundingBox.min[axis])/(original.boundingBox.max[axis]-original.boundingBox.min[axis])-factor)<1e-5);
const positions=resized.attributes.position;let min=Infinity,max=-Infinity;
for(let i=0;i<positions.count;i++)if(positions.getZ(i)===rectangle.depth){min=Math.min(min,positions.getX(i));max=Math.max(max,positions.getX(i));}
assert.ok(Math.abs(max-min-150)<.001,'Extruded surface resizes with its walls');
const cube=roundedBox({width:-60,height:50,depth:40,cornerRadius:5,widthSegments:3,heightSegments:2,depthSegments:4});cube.computeBoundingBox();assert.equal(cube.boundingBox.max.x-cube.boundingBox.min.x,60);assert.ok(cube.attributes.position.array.every(Number.isFinite));
assert.ok(cube.index.array.every(i=>i<cube.attributes.position.count));for(const g of [original,resized,cube])g.dispose();console.log('Custom extruded rectangle surface/wall resizing and rounded cube subdivisions pass');
