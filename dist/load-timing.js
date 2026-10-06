// Navigation-relative milestones; no timer gates scene startup or visibility.
export const loadTiming={values:{},listeners:new Set(),mark(name){
 if(this.values[name]!==undefined)return;
 this.values[name]=performance.now();
 for(const listener of this.listeners)listener(this.values);
}};
