declare module 'supercluster' {
  import type { GeoJsonProperties } from 'geojson';
  interface Options {
    minZoom?: number;
    maxZoom?: number;
    radius?: number;
    extent?: number;
    nodeSize?: number;
    log?: boolean;
    map?: (props: GeoJsonProperties) => any;
    reduce?: (accumulated: any, props: GeoJsonProperties) => void;
  }
  export default class Supercluster<PropType = any> {
    constructor(options?: Options);
    load<Geom extends GeoJSON.Feature<GeoJSON.Point, PropType>>(features: Geom[]): this;
    getClusters(bbox: [number, number, number, number], zoom: number): GeoJSON.Feature<any>[];
  }
} 