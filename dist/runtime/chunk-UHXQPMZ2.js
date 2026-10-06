var t={values:{},listeners:new Set,mark(e){if(this.values[e]===void 0){this.values[e]=performance.now();for(let s of this.listeners)s(this.values)}}};export{t as a};
