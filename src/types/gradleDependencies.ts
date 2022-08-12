export interface IGradleDependency {
  group: string,
  name: string,
  version: string,
  type: 'testImplementation' | 'implementation'
}