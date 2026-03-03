declare module "which-polygon" {
  interface QueryResult {
    [key: string]: string | number | undefined
  }

  interface QueryFunction {
    (point: [number, number]): QueryResult | undefined
  }

  function whichPolygon(geojson: object): QueryFunction
  export default whichPolygon
}
